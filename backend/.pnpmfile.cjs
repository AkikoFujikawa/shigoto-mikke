function readPackage(pkg) {
  // Firebase パッケージのビルドスクリプトを許可
  if (pkg.name && pkg.name.startsWith('@firebase')) {
    pkg.scripts = pkg.scripts || {}
  }
  return pkg
}

module.exports = {
  hooks: {
    readPackage
  }
}
