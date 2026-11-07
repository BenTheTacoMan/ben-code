// Ben Code: sign the packed app with the local certificate before electron-builder zips it.
// A stable certificate gives every build the same designated requirement, which Squirrel.Mac checks
// before it installs an update. Ad-hoc signatures change on every build and would be refused.
const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function afterPack(context) {
  const identity = process.env.BEN_CODE_SIGN_IDENTITY;
  if (!identity || context.electronPlatformName !== "darwin") return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const args = ["--force", "--deep", "--sign", identity];
  if (process.env.CSC_KEYCHAIN) args.push("--keychain", process.env.CSC_KEYCHAIN);
  execFileSync("codesign", [...args, app], { stdio: "inherit" });
};
