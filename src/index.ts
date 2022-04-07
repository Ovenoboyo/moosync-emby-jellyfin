import {
  ExtensionData,
  ExtensionFactory,
  ExtensionPreferenceGroup,
  MoosyncExtensionTemplate,
} from "@moosync/moosync-types"
import { MyExtension } from "./extension"
import semver from "semver"

export default class MyExtensionData implements ExtensionData {
  extensionDescriptors: ExtensionFactory[] = [new MyExtensionFactory()]
}

class MyExtensionFactory implements ExtensionFactory {
  async registerPreferences(): Promise<ExtensionPreferenceGroup[]> {
    return [
      {
        type: "EditText",
        key: "emby_url",
        title: "URL of Emby server",
        description: "Location at which your Emby/Jellyfin instance is hosted",
        default: "http://localhost:8096",
      },
      {
        type: "EditText",
        key: "emby_username",
        title: "Username",
        description: "API key for your Emby/Jellyfin instance",
        default: "",
      },
      {
        type: "EditText",
        key: "emby_password",
        inputType: "password",
        title: "Password",
        description: "API key for your Emby/Jellyfin instance",
        default: "",
      },
    ]
  }

  async create(): Promise<MoosyncExtensionTemplate> {
    if (!semver.satisfies(process.env.MOOSYNC_VERSION, ">=1.3.0")) {
      logger.warn(
        "This extension was made for Moosync version 1.3.0 or above. Current version is",
        process.env.MOOSYNC_VERSION
      )
    }
    return new MyExtension()
  }
}
