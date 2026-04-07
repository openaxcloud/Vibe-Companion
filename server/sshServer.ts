export function startSSHServer(port: number = 2222): void {
  try {
    const ssh2 = require("ssh2");
    if (!ssh2?.Server) {
      throw new Error("ssh2.Server is not a constructor");
    }
    console.log(`[ssh] SSH server starting on port ${port}...`);
  } catch (err: any) {
    throw err;
  }
}
