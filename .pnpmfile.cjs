function readPackage(pkg, context) {
    if (pkg.name === 'sqlite3') {
        context.log('Allowing sqlite3 to run its build scripts');
        pkg.requiresBuild = true;
    }
    return pkg;
}

module.exports = {
    hooks: {
        readPackage
    }
};