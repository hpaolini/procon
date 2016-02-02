/*-----------------------------------------------------
  Copyright (c) 2016 Hunter Paolini.  All Rights Reserved.
  -----------------------------------------------------*/

(function () {
    "use strict";

    const contentPath = "chrome://procon/content/",
          branch = "extensions.procon.",
          Cu = Components.utils;

    const {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

    var stringBundle = Services.strings.createBundle("chrome://procon/locale/overlay.properties?" + Math.random()), // Randomize URI to work around bug 719376
        preferences = {},
        context = {},
        input,
        pass;

    Services.scriptloader.loadSubScript(contentPath + "preferences.js", preferences, "UTF-8");

    if (preferences.hasPref(branch + "general.password")) {

        input = window.prompt(stringBundle.GetStringFromName("passwordPrompt"), "");
        pass = preferences.getPrefByType(branch + "general.password");
        Services.scriptloader.loadSubScript(contentPath + "md5.js", context, "UTF-8");

        if (input != null && context.hex_md5(input) == pass) {
            return true; 
        } else {
            return false;
        }
    }

    return true; 
}());
