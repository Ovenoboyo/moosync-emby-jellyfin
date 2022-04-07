declare const api: import("@moosync/moosync-types").extensionAPI
declare const logger: {
  log: Function
  error: Function
  info: Function
  warn: Function
  trace: Function
  debug: Function
}

interface Collections {
  Items: {
    Name: string
    ServerId: string
    Id: string
    IsFolder: true
    Type: "CollectionFolder"
    CollectionType: "music"
    ImageTags: {
      Primary: string
    }
    BackdropImageTags: []
  }[]
}

interface UserAuthentication {
  User: {
    Id: string
    Policy: {
      AuthenticationProviderId: string
    }
  }
  AccessToken: string
}

interface CollectionContent {
  Items: {
    Name: string
    ServerId: string
    Id: string
    RunTimeTicks: 2160000000
    IndexNumber: 60
    ParentIndexNumber: 1
    IsFolder: false
    Type: "Audio"
    UserData: [Object]
    Artists: string[]
    Album: string
    AlbumId: string
    AlbumPrimaryImageTag: string
    AlbumArtist: string
    AlbumArtists: string[]
    ImageTags: {
      Primary: string
    }
    BackdropImageTags: []
    MediaType: "Audio"
  }[]
}
