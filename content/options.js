/*-----------------------------------------------------
  Copyright (c) 2016 Hunter Paolini.  All Rights Reserved.
  -----------------------------------------------------*/

//TODO: we need to clean a bit all this file 

"use strict";

const Ci = Components.interfaces,
      Cc = Components.classes,
      Cu = Components.utils;

const contentPath = "chrome://procon/content/",
      branch = "extensions.procon.",
      host = "procon:";

const {Services} = Cu.import("resource://gre/modules/Services.jsm", {});
//var console = (Cu.import("resource://gre/modules/Console.jsm", {})).console;

var stringBundle = Services.strings.createBundle('chrome://procon/locale/overlay.properties?' + Math.random()),
    preferences = {};

Services.scriptloader.loadSubScript(contentPath + "preferences.js", preferences, "UTF-8");

function getItem (id) {
    return document.getElementById(id);
}

const ui = {
    toggleBoxes: function () {
        getItem("blacklist.sites.enabled").disabled = getItem("blacklist.words.enabled").disabled = !(getItem("blacklist.enabled").checked);
        getItem("blacklist.advanced.customWarningMsg").disabled = !(getItem("blacklist.advanced.customWarning").checked);
        getItem("blacklist.advanced.redirectURL").disabled = !(getItem("blacklist.advanced.redirect").checked);
    },

    updatePasswordButtons: function () {
        if (preferences.hasPref(branch + "general.password")) {
            getItem("passset-anchor").className = "hidden";
            getItem("passremove-anchor").className = "";
        } else {
            getItem("passset-anchor").className = "";
            getItem("passremove-anchor").className = "hidden";
        }
    },

    showThis: function (id, a) {
        var sidebarEl = getItem("sidebar").children[0].children,
            contentEl = getItem("content").children,
            i;

        i = contentEl.length;
        while (i--) {
            if (contentEl[i].tagName == "div") {
                contentEl[i].className = "hidden";
            }
        }

        i = sidebarEl.length; // - 1; //don't count for subscription button
        while (i--) {
            sidebarEl[i].className = "";
        }

        getItem(id).className = "";
        a.parentElement.className = "clicked";
    },

    showAdvancedSettings: function (element) {
        getItem("advanced").className = "";
        element.className = "hidden";
    },

    enableApplyButton: function () {
        getItem("apply-anchor").parentElement.className = "yellow";
    },

    disableApplyButton: function () {
        getItem("apply-anchor").parentElement.className = "yellow disabled";
    }
};

function b64EncodeUnicode (str) {
    return encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
        return String.fromCharCode('0x' + p1);
    });
}

function load () {
    window.removeEventListener("load", load);

    var authenticate = {};
    Services.scriptloader.loadSubScript(contentPath + "authenticate.js", authenticate, "UTF-8");

    if (authenticate.isAuthenticated()) {
        settings("load");
        document.body.className = "";
        window.addEventListener("unload", unload, false);
    } else {
        location.replace("data:text/html;charset=utf-8;base64," +
            btoa(
                "<!DOCTYPE html>" +
                "<html>" +
                "<head><title>" + b64EncodeUnicode(stringBundle.GetStringFromName("passwordPromptWrong")) + "</title></head>" +
                "<body><h1>" + b64EncodeUnicode(stringBundle.GetStringFromName("unavailablePage") + " " + stringBundle.GetStringFromName("passwordPromptWrong")) + "</h1></body>" +
                "</html>"
            )
        );
    }
}

function unload () {
    window.removeEventListener("unload", unload);

    var textarea = document.getElementsByTagName("textarea"),
        input = document.getElementsByTagName("input"),
        i;

    i = input.length;
    while (i--) {
        input[i].removeEventListener("click", ui.enableApplyButton);
    }

    i = textarea.length;
    while (i--) {
        textarea[i].removeEventListener("click", ui.enableApplyButton);
    }
}

function save (anchor) {
    if (typeof anchor !== "undefined" && anchor.id == "apply-anchor") {
        ui.disableApplyButton();
        settings("save");
    }

    // update new subscriptions
    if (getItem("subscriptions.enabled").checked) {
        updateSubscriptions();
    }

    Services.cpmm.sendSyncMessage(host + "filterUpdate", {fn: "updatePrefs"});
    Services.cpmm.sendAsyncMessage(host + "updateObserverStatus", {});
    Services.cpmm.sendAsyncMessage(host + "updateWidgetStatus", {});

    if (preferences.getPrefByType(branch + "blacklist.advanced.renderDelay") == true) {
        preferences.setPrefByType("nglayout.initialpaint.delay", 100000);
    } else {
        preferences.setPrefByType("nglayout.initialpaint.delay", 0);
    }
}

function settings (action) {
    var textarea = document.getElementsByTagName("textarea"),
        input = document.getElementsByTagName("input"),
        loading = (action == "load"),
        saving = (action == "save"),
        i, k, subscriptions, j;

    // add scheme if user forgets
    function fixURL (url) {
        if (url.length > 0 && !/\:\/\//.test(url)) {
            url = "http://" + url;
        }
        return url;
    }

    i = input.length;
    while (i--) {
        if (input[i].type == "checkbox") {
            if (loading) {
                input[i].checked = preferences.getPrefByType(branch + input[i].id);
                input[i].addEventListener("click", ui.enableApplyButton, false);
            } else if (saving) {
                preferences.setPrefByType(branch + input[i].id, input[i].checked);
            }
        } else if (input[i].type == "text") {
            if (loading) {
                input[i].value = preferences.getPrefByType(branch + input[i].id);
                input[i].addEventListener("click", ui.enableApplyButton, false);
            } else if (saving) {
                if (input[i].id == "blacklist.advanced.redirectURL") {
                    input[i].value = fixURL(input[i].value);
                }
                preferences.setPrefByType(branch + input[i].id, input[i].value);
            }
        }
    }

    k = textarea.length;
    while (k--) {
        if (loading) {
            if (textarea[k].id == "subscriptions.urls") {
                subscriptions = JSON.parse(preferences.getPrefByType(branch + textarea[k].id));
                for (j in subscriptions) {
                    subscriptions[j] = decodeURIComponent(subscriptions[j]);
                }
                textarea[k].value = subscriptions.join("\n");
            } else {
                textarea[k].value = preferences.getPrefByType(branch + textarea[k].id);
            }
            textarea[k].addEventListener("click", ui.enableApplyButton, false);
        } else if (saving) {
            if (textarea[k].id == "subscriptions.urls") {
                subscriptions = textarea[k].value.split("\n");
                for (j in subscriptions) {
                    subscriptions[j] = encodeURIComponent(decodeURIComponent(subscriptions[j]));
                }
                preferences.setPrefByType(branch + textarea[k].id, JSON.stringify(subscriptions));
            } else {
                preferences.setPrefByType(branch + textarea[k].id, textarea[k].value);
            }
        }
    }

    if (loading) {
        ui.toggleBoxes();
        ui.updatePasswordButtons();
    }
}

const accessPass = {
    set: function () {

        var pass1 = {value: ""},
            pass2 = {value: ""},
            promptResult,
            context = {};

        promptResult = Services.prompt.promptPassword(null,
            stringBundle.GetStringFromName("passwordPromptTitle"),
            stringBundle.GetStringFromName("passwordPrompt"),
            pass1,
            null,
            {value: false}); // need to pass an object for the checkbox even if hidden

        if (pass1.value.length > 0) {
            promptResult = Services.prompt.promptPassword(null,
                stringBundle.GetStringFromName("passwordPromptTitle"),
                stringBundle.GetStringFromName("passwordPromptAgain"),
                pass2,
                null,
                {value: false}); // need to pass an object for the checkbox even if hidden

            if (pass1.value === pass2.value) {
                Services.scriptloader.loadSubScript(contentPath + "md5.js", context, "UTF-8");
                preferences.setPrefByType(branch + "general.password", context.hex_md5(pass1.value));
                Services.prompt.alert(null,
                    stringBundle.GetStringFromName("passwordPromptTitle"),
                    stringBundle.GetStringFromName("passwordPromptSuccess"));
            } else {
                Services.prompt.alert(null,
                    stringBundle.GetStringFromName("passwordPromptTitle"),
                    stringBundle.GetStringFromName("passwordPromptFailure"));
            }
        }
        ui.updatePasswordButtons();
    },

    remove: function () {
        preferences.clearPref(branch + "general.password");
        Services.prompt.alert(null,
            stringBundle.GetStringFromName("passwordPromptTitle"),
            stringBundle.GetStringFromName("passwordRemoved"));
        ui.updatePasswordButtons();
    }
};

function updateSubscriptions () {
    var subscriptions = {};
    Services.scriptloader.loadSubScript(contentPath + "subscriptions.js", subscriptions, "UTF-8");
    subscriptions.load();
}

const io = {
    allowedPrefs: [
        "blacklist\\.advanced\\.customWarning",
        //"blacklist\\.advanced\\.examineMeta",
        "blacklist\\.advanced\\.limitNetAccess",
        "blacklist\\.advanced\\.redirect",
        "blacklist\\.advanced\\.renderDelay",
        "blacklist\\.advanced\\.showDetails",
        "blacklist\\.enabled",
        "blacklist\\.sites\\.enabled",
        "blacklist\\.words\\.enabled",
        "profanitylist\\.enabled",
        "subscriptions\\.enabled",
        "whitelist\\.enabled",
        "blacklist\\.advanced\\.customWarningMsg",
        "blacklist\\.advanced\\.redirectURL",
        "blacklist\\.sites",
        "blacklist\\.words",
        "profanitylist\\.placeholder",
        "profanitylist\\.words",
        "subscriptions\\.urls",
        "whitelist\\.sites"
    ],

    exportFile: function () {
        var str = "[ProCon Latte 4.0]\n# Updated: " + new Date() + "\n\n# preferences\n", endStr = "",
            allowedPrefsRegex = new RegExp("^\\b(?:" + io.allowedPrefs.join("|") + ")\\b", "i"),
            children, count, i, name, value, valueArr, len, j, blob, a;

        function convertUnicodeToUTF8 (str) {
            var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter),
                UTF, fin;

            converter.charset = "UTF-8";
            UTF = converter.ConvertFromUnicode(str);
            fin = converter.Finish();

            if (fin.length > 0) {
                return UTF + fin;
            }

            return UTF;
        }

        children = preferences.getChildList(branch);
        count = children.length;

        for (i = 0; i < count; ++i) {
            name = children[i];
            if (allowedPrefsRegex.test(name)) {
                value = preferences.getPrefByType(branch + name);
                
                if (name == "profanitylist.words" || name == "blacklist.sites" || name == "blacklist.words" || name == "whitelist.sites") {
                    valueArr = value.split("\n");
                    if (valueArr.length > 1) {
                        endStr += name + " =\n" + value + "\n\n";
                    } else {
                        endStr += name + " = " + value + "\n\n";
                    }
                } else if (name == "subscriptions.urls") {
                    value = JSON.parse(value);
                    len = value.length;

                    for (j = 0; j < len; j++) {
                        value[j] = decodeURIComponent(value[j]);
                    }

                    value = value.join("\n");
                    if (len > 1) {
                        endStr += name + " =\n" + value + "\n\n";
                    } else {
                        endStr += name + " = " + value + "\n\n";
                    }
                } else {
                    str += name + " = " + value + "\n";
                }
            }
        }

        str += "\n" + endStr;
        str = convertUnicodeToUTF8(str);
        blob = new Blob([str], {type: "text/plain"});
        a = document.createElement("a");
        document.body.appendChild(a);
        a.style = "display:none";
        a.href = window.URL.createObjectURL(blob);
        a.download = "procon.txt";
        a.click();
        document.body.removeChild(a);
    },

    importFile: function () {
        const {TextDecoder, OS} = Cu.import("resource://gre/modules/osfile.jsm", {}),
              nsIFilePicker = Ci.nsIFilePicker;
        var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker),
            rv, decoder, promise;

        fp.init(window, null, fp.modeOpen);
        fp.defaultExtension = 'txt';
        fp.appendFilter("ProCon " + stringBundle.GetStringFromName('configFile'), "*.txt");
        fp.appendFilters(fp.filterAll);

        rv = fp.show();
        if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
            decoder = new TextDecoder();        // This decoder can be reused for several reads
            promise = OS.File.read(fp.file.path); // Read the complete file as an array
            promise = promise.then(
            function onSuccess(array) {
                var listRegex, allowedPrefsRegex, i, element, name, index, value, firstVal, j;
                array = decoder.decode(array).replace(/\r\n|\n\r|\n|\r/g, "\n").split("\n");

                if (!array || !(/^\[procon latte.*\]$/gi.test(array[0]))) {
                    return false;
                }

                listRegex = new RegExp("^\\b(?:profanitylist\\.words|blacklist\\.(?:sites|words)(?!\\.enabled)|whitelist\\.sites|subscriptions\\.urls)\\b", "i");
                allowedPrefsRegex = new RegExp("^\\b(?:" + io.allowedPrefs.join("|") + ")\\b", "i");

                for (i = 1; i < array.length; i++) {
                    element = array[i];

                    if (element.length < 3 || /^\s*#/m.test(element)) {
                        continue;
                    }

                    if (listRegex.test(element)) {
                        name = element.match(listRegex)[0];
                        index = element.indexOf("=");
                        if (index <= 0) {
                            continue;
                        }
                        
                        value = [];
                        firstVal = element.substring(index + 1, element.length).replace(/^\s+|\s+$/g, "");
                        
                        if (firstVal.length > 0) {
                            value.push(firstVal);
                        }
                        
                        while (array[++i] && array[i].length > 0 && !(allowedPrefsRegex.test(array[i]))) {
                            value.push(array[i]);
                        }

                        i--;

                        if (name == "subscriptions.urls") {
                            for (j = 0; j < value.length; j++) {
                                value[j] = encodeURIComponent(decodeURIComponent(value[j]));
                            }
                            preferences.setPrefByType(branch + name, JSON.stringify(value));
                        } else {
                            preferences.setPrefByType(branch + name, value.join("\n"));
                        }
                    } else {
                        index = element.indexOf("=");
                        if (index <= 0) {
                            continue;
                        }
                        
                        name = element.substring(0, index).replace(/^\s+|\s+$/g, "");
                        value = element.substring(index + 1, element.length).replace(/^\s+|\s+$/g, "");
                        if (allowedPrefsRegex.test(name)) {
                            preferences.setPrefByType(branch + name, value);
                        }
                    }
                };

                save();
                settings("load");
                Services.prompt.alert(null,
                    null,
                    stringBundle.GetStringFromName("importSuccess"));
                return true;
            });
        }
        return false;
    },

    reset: function () {
        var result = Services.prompt.confirm(null,
            null,
            stringBundle.GetStringFromName("restorePrompt"));

        if (!result) {
            return;
        }

        preferences.clearPref("nglayout.initialpaint.delay");
        preferences.setDefaultPref();
        save();
        settings("load");
        Services.prompt.alert(null,
            null,
            stringBundle.GetStringFromName("restorePromptSuccess"));
    }
};

window.addEventListener("load", load);
