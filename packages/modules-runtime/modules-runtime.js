var options = {};
var hasOwn = options.hasOwnProperty;

// RegExp matching strings that don't start with a `.` or a `/`.
var topLevelIdPattern = /^[^./]/;

if (typeof Profile === "function" &&
    process.env.METEOR_PROFILE) {
  options.wrapRequire = function (require) {
    return Profile(function (id) {
      return "require(" + JSON.stringify(id) + ")";
    }, require);
  };
}

// On the client, make package resolution prefer the "browser" field of
// package.json files to the "main" field.
options.browser = Meteor.isClient;

// This function will be called whenever a module identifier that hasn't
// been installed is required. For backwards compatibility, and so that we
// can require binary dependencies on the server, we implement the
// fallback in terms of Npm.require.
options.fallback = function (id, parentId, error) {
  // For simplicity, we honor only top-level module identifiers here.
  // We could try to honor relative and absolute module identifiers by
  // somehow combining `id` with `dir`, but we'd have to be really careful
  // that the resulting modules were located in a known directory (not
  // some arbitrary location on the file system), and we only really need
  // the fallback for dependencies installed in node_modules directories.
  if (topLevelIdPattern.test(id)) {
    if (typeof Npm === "object" &&
        typeof Npm.require === "function") {
      return Npm.require(id);
    }
  }

  throw error;
};

options.fallback.resolve = function (id, parentId, error) {
  if (Meteor.isServer &&
      topLevelIdPattern.test(id)) {
    // Allow any top-level identifier to resolve to itself on the server,
    // so that options.fallback can have a chance to handle it.
    return id;
  }

  throw error;
};

meteorInstall = makeInstaller(options);
var Mp = meteorInstall.Module.prototype;

if (Meteor.isServer) {
  Mp.useNode = function () {
    if (typeof npmRequire !== "function") {
      // Can't use Node if npmRequire is not defined.
      return false;
    }

    var parts = this.id.split("/");
    var start = 0;
    if (parts[start] === "") ++start;
    if (parts[start] === "node_modules" &&
        parts[start + 1] === "meteor") {
      start += 2;
    }

    if (parts.indexOf("node_modules", start) < 0) {
      // Don't try to use Node for modules that aren't in node_modules
      // directories.
      return false;
    }

    try {
      npmRequire.resolve(this.id);
    } catch (e) {
      return false;
    }

    this.exports = npmRequire(this.id);

    return true;
  };
}