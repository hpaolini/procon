/*-----------------------------------------------------
  Copyright (c) 2016 Hunter Paolini.  All Rights Reserved.
  -----------------------------------------------------*/

const Ci = Components.interfaces,
      Cc = Components.classes,
      Cu = Components.utils;

const {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

function getChildList (branch) {
    var branch = Services.prefs.getBranch(branch);
    return branch.getChildList(""); 
}

function getPrefByType (name) {
    switch (Services.prefs.getPrefType(name)) {
        case Services.prefs.PREF_BOOL:
            return Services.prefs.getBoolPref(name);
        case Services.prefs.PREF_INT:
            return Services.prefs.getIntPref(name);
        case Services.prefs.PREF_STRING:
            try {
                return Services.prefs.getComplexValue(name, Ci.nsIPrefLocalizedString).data;
            } catch(e) {
                return Services.prefs.getComplexValue(name, Ci.nsISupportsString).data;
            }
        default:
            break;
    }
    return null;
}

function setPrefByType (name, value) {
    // prevent value from being evaluated as string if we ever pass it as "true" or "false"
    if (typeof value === "string" && (/^(true|false)$/i).test(value)) {
        value = (/^true$/i).test(value);
    }

    switch (typeof value) {
        case "boolean":
            Services.prefs.setBoolPref(name, value);
            break;
        case "number":
            Services.prefs.setIntPref(name, value);
            break;
        case "string":
        default: // general.password will not exist when the user removes the password
            var str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
            str.data = value;
            Services.prefs.setComplexValue(name, Ci.nsISupportsString, str);
            break;
    }
}

function setMissingPref (name, value) {
    if (getPrefByType(name) == null) {
        setPrefByType(name, value);
    }
}

function setDefaultPref (firstRun) {
    Services.scriptloader.loadSubScript("chrome://procon/content/defaultprefs.js", {pref: (firstRun) ? setMissingPref : setPrefByType});
}

function clearPref (name) {
    Services.prefs.clearUserPref(name);
}

function hasPref (name) {
    return Services.prefs.prefHasUserValue(name);
}
