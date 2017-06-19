/*-----------------------------------------------------
  Copyright (c) 2016 Hunter Paolini.  All Rights Reserved.
  -----------------------------------------------------*/

"use strict";

function load () {
    const currentVersion = "4.2",
          contentPath = "chrome://procon/content/",
          branch = "extensions.procon.",
          oldBranch = "procon.",
          host = "procon:";

    var preferences = {},
        oldName,
        newName,
        prefNames = {
            // booleans
            "whitelist.enabled": "enableWhiteList",
            "blacklist.enabled": "enabled",
            "blacklist.advanced.limitNetAccess": "bat",
            "blacklist.advanced.renderDelay": "pDelay",
            //"blacklist.advanced.examineMeta": "exMeta", // deprecated since 4.0
            "blacklist.advanced.showDetails": "reason",
            "blacklist.advanced.customWarning": "customWarn", 
            "blacklist.advanced.redirect": "pcust",      
            "profanitylist.enabled": "filteron",
            //"misc.showStatusButton": "pstatus", // deprecated since 4.0
            //"misc.showMenuButton": "htm", // deprecated since 4.0
            //"blacklist.words.enabled": "",
            //"blacklist.sites.enabled": "" 

            // strings
            "profanitylist.placeholder": "customCens",
            "whitelist.sites": "whiteList",
            "blacklist.sites": "urlregex",
            "blacklist.advanced.customWarningMsg": "WarningMsg",
            "blacklist.words": "wordregex",
            "profanitylist.words": "wordlist",
            "blacklist.advanced.redirectURL": "psit"
            //"general.password": "password"
        };

    const {Services} = Cu.import("resource://gre/modules/Services.jsm", {});
    Services.scriptloader.loadSubScript(contentPath + "preferences.js", preferences, "UTF-8");

    for (newName in prefNames) {
        oldName = prefNames[newName];
        if (preferences.hasPref(oldBranch + oldName)) {
            preferences.setPrefByType(branch + newName, preferences.getPrefByType(oldBranch + oldName));
            preferences.clearPref(oldBranch + oldName);
        }
    }

    if (preferences.hasPref(oldBranch + "password")) {
        preferences.setPrefByType(branch + "general.password", preferences.getPrefByType(oldBranch + "password"));
        preferences.clearPref(oldBranch + "password");
    }

    if (preferences.hasPref(oldBranch + "action")) {
        switch (preferences.getPrefByType(oldBranch + "action")) {
            case 0:
                preferences.setPrefByType(branch + "blacklist.words.enabled", true);
                preferences.setPrefByType(branch + "blacklist.sites.enabled", false);
                break;
            case 1:
                preferences.setPrefByType(branch + "blacklist.words.enabled", false);
                preferences.setPrefByType(branch + "blacklist.sites.enabled", true);
                break;
            case 2:
                preferences.setPrefByType(branch + "blacklist.words.enabled", true);
                preferences.setPrefByType(branch + "blacklist.sites.enabled", true);
                break;
            default:
                break;
        }
        preferences.clearPref(oldBranch + "action");
    }

    if (preferences.hasPref(oldBranch + "authenticated")) {
        preferences.clearPref(oldBranch + "authenticated");
    }

    if (preferences.hasPref(oldBranch + "addons")) {
        preferences.clearPref(oldBranch + "addons");
    }

    preferences.setPrefByType(branch + "currentVersion", currentVersion);
    Services.cpmm.sendAsyncMessage(host + "filterUpdate", {fn: "updatePrefs"});
}
