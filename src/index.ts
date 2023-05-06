import { join } from "path";
import { readdirSync, statSync } from "fs";
import c from "picocolors";
import {type DefaultTheme, type SiteConfig} from "vitepress";
import { type ViteDevServer} from "vite";
import { SidebarPluginOptionType } from "./types";

const DEFAULT_IGNORE_FOLDER = ["scripts", "components", "assets", ".vitepress"];
let option:SidebarPluginOptionType;
interface UserConfig {
  vitepress: SiteConfig
}

function log(...info: string[]) {
  console.log(c.bold(c.cyan("[auto-sidebar]")), ...info);
}

// remove the file prefix
function removePrefix(str:string, identifier:string) {
	const index = str.indexOf(identifier)
	if (index === -1) {
		return str
	} else {
		return str.slice(index + identifier.length)
	}
}

function createSideBarItems(
  targetPath: string,
  ...reset: string[]
): DefaultTheme.SidebarItem[] {
  const { ignoreIndexItem } = option;
  let node = readdirSync(join(targetPath, ...reset));
  if (ignoreIndexItem && node.length === 1 && node[0] === "index.md") {
    return [];
  }
  const result: DefaultTheme.SidebarItem[] = [];
  for (const fname of node) {
    if (statSync(join(targetPath, ...reset, fname)).isDirectory()) {
      // is directory
      // ignore cur node if items length is 0
      const items = createSideBarItems(
        join(targetPath),
        ...reset,
        fname
      );
	  let text = fname
	  if (option.prefix) {
	    text = removePrefix(text, option.prefix) 
	  }
      if (items.length > 0) {
		const sidebarItem: DefaultTheme.SidebarItem = {
			text, 
			items, 
		}
		// vitePress siderBar option collapsed
		if (Reflect.has(option, 'collapsed')) {
		   	sidebarItem.collapsed = Reflect.get(option, 'collapsed')
		}
       	result.push(sidebarItem)
      }
    } else {
      // is filed
      if (ignoreIndexItem && fname === "index.md" || /^-.*\.(md|MD)$/.test(fname)) {
        continue;
      }
      let fileName = fname.replace(/\.md$/, '') 
      let text = fileName 
      if (option.prefix) {
        text = removePrefix(text, option.prefix) 
      }

      const item: DefaultTheme.SidebarItem = {
        text,
        link: '/' + [...reset, `${fileName}.html`].join("/"),
      };
      result.push(item);
    }
  }
  return result;
}

function createSideBarGroups(
  targetPath: string,
  folder: string
): DefaultTheme.SidebarItem[] {
  return [
    {
      items: createSideBarItems(targetPath, folder),
    },
  ];
}

function createSidebarMulti(
  path: string
): DefaultTheme.SidebarMulti {
  const { ignoreList = [], ignoreIndexItem = false } = option;
  const il=[...DEFAULT_IGNORE_FOLDER,...ignoreList]
  const data: DefaultTheme.SidebarMulti = {};
  let node = readdirSync(path).filter(
    (n) => statSync(join(path, n)).isDirectory() && !il.includes(n)
  );

  for (const k of node) {
    data[`/${k}/`] = createSideBarGroups(path, k);
  }

  // is ignored only index.md
  if (ignoreIndexItem) {
    for (const i in data) {
      let obj = data[i];
      obj = obj.filter((i) => i.items && i.items.length > 0);
      if (obj.length === 0) {
        Reflect.deleteProperty(data, i);
      }
    }
  }

  return data;
}

export default function VitePluginVitePressAutoSidebar(
  opt: SidebarPluginOptionType = {}
) {
  return {
    name: "vite-plugin-vitepress-auto-sidebar",
    configureServer({ watcher, restart}: ViteDevServer) {
      const fsWatcher = watcher.add("*.md");
      fsWatcher.on("all", (event, path) => {
        if (event !== "change") {
          restart()
          log(`${event} ${path}`);
          log("update sidebar...");
        }
      });
    },
    config(config:UserConfig){
      option = opt;
      const { path = "/docs" } = option;

      // increment ignore item
      const docsPath = join(process.cwd(), path);
      // create sidebar data and insert
      config.vitepress.site.themeConfig.sidebar = createSidebarMulti(docsPath);
      log("injected sidebar data successfully");
      return config;
    }
  };
}
