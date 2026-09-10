const { bot } = require('../lib/')
const { OWNER_NAME, OWNER_NUMBER } = require('../config')

bot(
  {
    pattern: 'owner',
    desc: 'Show the VØRAXIS MD owner information',
    type: 'misc',
  },
  async (message) => {
    const number = String(OWNER_NUMBER || '').replace(/\D/g, '')
    const contact = number ? `+${number}` : 'Non configuré'
    return await message.send(
      `╭━━━〔 𝗢𝗪𝗡𝗘𝗥 〕━━━╮\n┃\n┃  ⟡ 𝗡𝗔𝗠𝗘 : ${OWNER_NAME}\n┃  ⟡ 𝗡𝗨𝗠𝗕𝗘𝗥 : ${contact}\n┃\n╰━━━〔 𝗩Ø𝗥𝗔𝗫𝗜𝗦 𝗠𝗗 〕━━━╯`
    )
  }
)
