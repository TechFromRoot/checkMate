export const welcomeMessageMarkup = async (userName: string) => {
  return {
    message: `Hello @${userName} 👋\n\nWelcome to <b>CheckMate</b> bot ♟️\nYour go-to bot for scanning Solana tokens. \nPowered by <a href="https://rugcheck.xyz">RugCheck</a>\n\nJust drop a token address and get an instant risk score, analysis, and more — all in one tap.\n\nTrade smart. Stay safe. 🛡️`,
  };
};
