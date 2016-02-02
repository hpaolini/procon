/*-----------------------------------------------------
  Copyright (c) 2016 Hunter Paolini.  All Rights Reserved.
  -----------------------------------------------------*/

"use strict";

const Ci = Components.interfaces,
      Cc = Components.classes,
      Cu = Components.utils;

const contentPath = "chrome://procon/content/",
      branch = "extensions.procon.",
      host = "procon:";

const {Services} = Cu.import("resource://gre/modules/Services.jsm", {});
//let console = (Cu.import("resource://gre/modules/Console.jsm", {})).console;

var preferences = {},
    list = {},
    jsm = {};

Services.scriptloader.loadSubScript(contentPath + "preferences.js", preferences, "UTF-8");
Services.scriptloader.loadSubScript(contentPath + "formatList.js", list, "UTF-8");

var cacheObj = function () {
    this.blacklist = {};
    this.whitelist = {};
};

var blacklistObj = function () {
    let subscriptions_sites = [], subscriptions_words = [],
        subscriptions_sitesObj, subscriptions_wordsObj,
        sites, words;

    this.enabled = preferences.getPrefByType(branch + "blacklist.enabled");

    if (preferences.getPrefByType(branch + "subscriptions.enabled")) {
        subscriptions_sitesObj = preferences.getPrefByType(branch + "subscriptions.blacklist.sites");
        subscriptions_wordsObj = preferences.getPrefByType(branch + "subscriptions.blacklist.words");

        subscriptions_sitesObj = JSON.parse(subscriptions_sitesObj);
        subscriptions_wordsObj = JSON.parse(subscriptions_wordsObj);

        for (var i in subscriptions_sitesObj) {
            subscriptions_sites.push(subscriptions_sitesObj[i]);
        }

        for (var i in subscriptions_wordsObj) {
            subscriptions_words.push(subscriptions_wordsObj[i]);
        }
 
        subscriptions_sites = (subscriptions_sites.length)
            ? "|" + subscriptions_sites.join("|")
            : "";
        subscriptions_words = (subscriptions_words.length)
            ? "|" + subscriptions_words.join("|")
            : "";
    }

    sites = preferences.getPrefByType(branch + "blacklist.sites");
    words = preferences.getPrefByType(branch + "blacklist.words");
  
    this.sites = new RegExp(list.format(sites, list.TYPE.SITES) + subscriptions_sites, "gi");
    this.words = new RegExp(list.format(words, list.TYPE.WORDS) + subscriptions_words, "gi");
    this.sites_enabled = preferences.getPrefByType(branch + "blacklist.sites.enabled");
    this.words_enabled = preferences.getPrefByType(branch + "blacklist.words.enabled");

    //advanced preferences
    this.advanced_limitNetAccess = preferences.getPrefByType(branch + "blacklist.advanced.limitNetAccess");
    this.advanced_showDetails = preferences.getPrefByType(branch + "blacklist.advanced.showDetails");
    this.advanced_customWarning = preferences.getPrefByType(branch + "blacklist.advanced.customWarning");
    this.advanced_customWarningMsg = preferences.getPrefByType(branch + "blacklist.advanced.customWarningMsg");
    this.advanced_redirect = preferences.getPrefByType(branch + "blacklist.advanced.redirect");
    this.advanced_redirectURL = preferences.getPrefByType(branch + "blacklist.advanced.redirectURL");
    this.advanced_examineMeta = true; //Prefs.getBoolPref("blacklist.advanced.examineMeta");
};

var whitelistObj = function () {
    let subscriptions_sites = [],
        subscriptions_sitesObj,
        sites;
 
    this.enabled = preferences.getPrefByType(branch + "whitelist.enabled");

    if (preferences.getPrefByType(branch + "subscriptions.enabled")) {
        subscriptions_sitesObj = preferences.getPrefByType(branch + "subscriptions.whitelist.sites");
        subscriptions_sitesObj = JSON.parse(subscriptions_sitesObj);

        for (var i in subscriptions_sitesObj) {
            subscriptions_sites.push(subscriptions_sitesObj[i]);
        }
 
        subscriptions_sites = (subscriptions_sites.length)
            ? "|" + subscriptions_sites.join("|")
            : "";
    }
 
    sites = preferences.getPrefByType(branch + "whitelist.sites");

    if (this.enabled && preferences.getPrefByType(branch + "blacklist.advanced.redirect")) {
        this.sites = new RegExp(list.format(preferences.getPrefByType(branch + "blacklist.advanced.redirectURL") + "\n" + sites, list.TYPE.SITES) + subscriptions_sites, "gi");
    } else if (preferences.getPrefByType(branch + "blacklist.advanced.redirect")) {
        // BUGFIX: http://proconlatte.com/bugs/view.php?id=7
        this.sites = new RegExp(list.format(preferences.getPrefByType(branch + "blacklist.advanced.redirectURL"), list.TYPE.SITES), "gi");
        this.enabled = true;
    } else {
        this.sites = new RegExp(list.format(sites, list.TYPE.SITES) + subscriptions_sites, "gi");
    }

    // establish session access for blocked sites 
    this.session = {
        domains: {},
        pages: {}
    };
};

var profanitylistObj = function () {
    let subscriptions_words = [],
        subscriptions_wordsObj,
        words;

    this.enabled = preferences.getPrefByType(branch + "profanitylist.enabled");

    if (preferences.getPrefByType(branch + "subscriptions.enabled")) {
        subscriptions_wordsObj = preferences.getPrefByType(branch + "subscriptions.profanitylist.words");
        subscriptions_wordsObj = JSON.parse(subscriptions_wordsObj);

        for (var i in subscriptions_wordsObj) {
            subscriptions_words.push(subscriptions_wordsObj[i]);
        }
 
        subscriptions_words = (subscriptions_words.length)
            ? "|" + subscriptions_words.join("|")
            : "";
    }

    words = preferences.getPrefByType(branch + "profanitylist.words");

    this.words = new RegExp(list.format(words, list.TYPE.WORDS) + subscriptions_words, "gi");

    // regex might strip the first space sometimes
    this.placeholder = " " + preferences.getPrefByType(branch + "profanitylist.placeholder");
};

var prefs = {
    blacklist: new blacklistObj(),
    whitelist: new whitelistObj(),
    profanitylist: new profanitylistObj(),
    cache: new cacheObj()
};

function getPrefs () {
    return prefs;
}

function updatePreferences (msg) {
    var data = msg.data;

    switch (data.fn) {
        case "setWhitelistCache":
            prefs.cache.whitelist[data.url] = data.match;
            break;
        case "setBlacklistCache":
            prefs.cache.blacklist[data.url] = data.match;
            break;
        case "setWhitelistSessionPage":
            prefs.whitelist.session.pages[decodeURIComponent(data.url)] = 1;
            break;
        case "setWhitelistSessionDomain":
            prefs.whitelist.session.domains[decodeURIComponent(data.url)] = 1;
            break;
        case "updatePrefs":
            prefs = {
                blacklist: new blacklistObj(),
                whitelist: new whitelistObj(),
                profanitylist: new profanitylistObj(),
                cache: new cacheObj()
            };
            break;
        default :
            break;
    }

    return true;
}

function isJSMLoaded () {
    if (typeof jsm !== "undefined" && jsm.loaded) {
        return true;
    }
    return false;
}

function unload (msg) {
    // workaround http://bugzil.la/1202125
    // non-essential since timer in bootstrap's startup
    // if (msg.data.id !== id) {
    //     return;
    // }

    removeMessageListener(host + "unload", unload);
    Services.ppmm.removeMessageListener(host + "getPreferences", getPrefs);
    Services.ppmm.removeMessageListener(host + "filterUpdate", updatePreferences);

    // remove the module before the message listener, we don't
    // want for isJSMLoaded to be falsy if the module has not
    // yet been unloaded
    try {
        Cu.unload(contentPath + "filter.jsm");
    } catch (e) {
        // NS_ERROR_FILE_NOT_FOUND when add-on is disabled 
    }
    Services.ppmm.removeMessageListener(host + "isJSMLoaded", isJSMLoaded);
}

// var id = sendSyncMessage(host + "getScriptId")[0];
function load () {
    addMessageListener(host + "unload", unload);
    Services.ppmm.addMessageListener(host + "getPreferences", getPrefs);
    Services.ppmm.addMessageListener(host + "filterUpdate", updatePreferences);
    Services.ppmm.addMessageListener(host + "isJSMLoaded", isJSMLoaded);
    Cu.import(contentPath + "filter.jsm", jsm);
}

load();
