import {
  MoosyncExtensionTemplate,
  Playlist,
  Song,
} from "@moosync/moosync-types"
import axios from "axios"
import adapter from "axios/lib/adapters/http"
import semver from "semver"
import crypto from "crypto"
import { readFile, writeFile } from "fs/promises"
import path, { resolve } from "path"

export class MyExtension implements MoosyncExtensionTemplate {
  private axios = axios.create({ adapter })
  private baseURL = ""
  private userID = ""
  private username = ""
  private password = ""

  private accessToken = ""
  private deviceID = ""
  private serverType: "emby" | "jellyfin" = "emby"

  private scannedLibraries: Playlist[] = []

  async onStarted() {
    logger.info("Emby extension started")

    this.baseURL = await api.getPreferences<string>(
      "emby_url",
      "http://localhost:8096"
    )
    this.username = await api.getPreferences<string>("emby_username", "")
    this.password = await api.getSecure<string>("emby_password", "")

    console.log(this.baseURL, this.username, this.password)

    this.registerPlaylistListeners()

    if (semver.satisfies(process.env.MOOSYNC_VERSION, ">=1.3.0")) {
      await this.loginToEmby()
    }
  }

  private async getDeviceID() {
    const file = path.join(__dirname, "/device")
    try {
      this.deviceID = await readFile(file, { encoding: "utf-8" })
    } catch (e) {
      logger.warn("Failed to open", file, e)
    }

    if (!this.deviceID) {
      this.deviceID = crypto.randomUUID()
      writeFile(file, this.deviceID, { encoding: "utf-8", flag: "w+" })
    }

    return this.deviceID
  }

  private async makeUserRequest<T>(
    userID?: string,
    itemID?: string,
    customPath?: string,
    params?: string
  ): Promise<T | undefined> {
    let url = this.baseURL
    if (userID && this.accessToken) {
      url += `/Users/${userID}/`
    }

    url += `Items/${itemID ?? ""}/${customPath ?? ""}`.replace(
      /([^:]\/)\/+/g,
      "$1"
    )

    const headers: { [key: string]: string } = {
      "Content-Type": "application/json",
    }

    if (this.accessToken) {
      headers["X-Emby-Token"] = this.accessToken
      headers["X-Emby-Authorization"] = this.accessToken
    }

    logger.debug("Sending request to", url, headers)

    try {
      const resp = await this.axios.get<T>(`${url}${params ?? ""}`, {
        headers,
      })

      return resp.data
    } catch (e) {
      logger.error(e)
    }
  }

  private async loginToEmby() {
    console.info("logging in to emby")

    const headers = {
      Authorization: `Emby Client="Moosync", Device="${
        process.platform
      }", DeviceId="${await this.getDeviceID()}", Version="${
        process.env.MOOSYNC_VERSION
      }"`,
    }

    if (this.accessToken) {
      try {
        await this.axios.post(`${this.baseURL}/Sessions/Logout`)
      } catch (e) {
        console.warn("Failed to logout", e)
      }
    }

    try {
      const resp = await this.axios.post<UserAuthentication>(
        `${this.baseURL}/Users/AuthenticateByName`,
        {
          Username: this.username,
          Pw: this.password,
        },
        { headers }
      )

      if (
        resp.data.User.Policy.AuthenticationProviderId.toLocaleLowerCase().includes(
          "jellyfin"
        )
      ) {
        this.serverType = "jellyfin"
      } else {
        this.serverType = "emby"
      }

      this.accessToken = resp.data.AccessToken
      this.userID = resp.data.User.Id
    } catch (e) {
      logger.error("Error while authenticating", e)
    }
  }

  private async getEmbyLibraries() {
    const libraries = await this.getLibraries()
    const playlists = await this.getPlaylists()

    const allItems = [...libraries, ...playlists]

    const scanned: Playlist[] = []
    for (const l of allItems) {
      scanned.push({
        playlist_id: l.Id,
        playlist_name: l.Name,
        playlist_coverPath: this.getCoverImage(l.Id),
        icon: resolve(
          __dirname,
          `../public/${
            this.serverType === "emby" ? "emby_icon" : "jellyfin_icon"
          }.svg`
        ),
      })
    }

    this.scannedLibraries = scanned
  }

  private async getLibraryContent(itemID: string): Promise<Song[]> {
    const resp = await this.makeUserRequest<CollectionContent>(
      this.userID,
      undefined,
      undefined,
      `?ParentId=${itemID}&Recursive=true&IncludeItemTypes=Audio`
    )

    const songs: Song[] = []
    if (resp) {
      for (const r of resp.Items) {
        songs.push({
          _id: r.Id,
          title: r.Name,
          artists: r.Artists,
          song_coverPath_high: this.getCoverImage(r.Id),
          album: {
            album_name: r.Album,
            album_artist: r.AlbumArtist,
            album_coverPath_high:
              r.AlbumPrimaryImageTag &&
              this.getCoverImage(r.AlbumPrimaryImageTag),
          },
          duration: r.RunTimeTicks / 10000000,
          playbackUrl: this.getPlaybackURL(r.Id),
          type: "URL",
          date_added: Date.now(),
          icon: resolve(
            __dirname,
            `../public/${
              this.serverType === "emby" ? "emby_icon" : "jellyfin_icon"
            }.svg`
          ),
        })
      }
    }
    return songs
  }

  private getPlaybackURL(itemID: string) {
    return `${this.baseURL}/Audio/${itemID}/universal?UserId=${this.userID}&DeviceId=${this.deviceID}&api_key=${this.accessToken}&MaxStreamingBitrate=140000000&Container=opus%2Cwebm%7Copus%2Cmp3%2Caac%2Cm4a%7Caac%2Cm4b%7Caac%2Cflac%2Cwebma%2Cwebm%7Cwebma%2Cwav%2Cogg&TranscodingContainer=ts&TranscodingProtocol=hls&AudioCodec=aac&StartTimeTicks=0&EnableRedirection=true`
  }

  private getCoverImage(itemID: string) {
    return `${this.baseURL}/Items/${itemID}/Images/Primary`
  }

  private async getLibraries() {
    const resp = await this.makeUserRequest<Collections>(this.userID)
    const musicLibraries: Collections["Items"] = []

    if (resp) {
      for (const d of resp.Items) {
        if (d.CollectionType === "music") {
          musicLibraries.push(d)
        }
      }
    }
    return musicLibraries
  }

  private async getPlaylists() {
    const resp = await this.makeUserRequest<Collections>(
      this.userID,
      undefined,
      undefined,
      "?Recursive=true&IncludeItemTypes=playlist"
    )

    return resp.Items ?? []
  }

  async onPreferenceChanged({
    key,
    value,
  }: {
    key: string
    value: any
  }): Promise<void> {
    if (key === "emby_url") {
      this.baseURL = value
    }

    if (key === "emby_username") {
      this.username = value
    }

    if (key === "emby_password") {
      this.password = value
    }

    if (semver.satisfies(process.env.MOOSYNC_VERSION, ">=1.3.0")) {
      await this.loginToEmby()
    }
  }

  private registerPlaylistListeners() {
    if (semver.satisfies(process.env.MOOSYNC_VERSION, ">=1.3.0")) {
      api.on("get-playlists", async () => {
        await this.getEmbyLibraries()
        return {
          playlists: this.scannedLibraries,
        }
      })

      api.on("get-playlist-songs", async (playlist_id) => {
        const songs = await this.getLibraryContent(playlist_id)
        return {
          songs,
        }
      })
    }
  }
}
