const {
  addSpace,
  textToStylist,
  getUptime,
  getRam,
  getDate,
  getPlatform,
  bot,
  lang,
} = require('../lib/')

const BRAND = '𝗩Ø𝗥𝗔𝗫𝗜𝗦 𝗠𝗗'
const title = '𝙼𝙴𝙽𝚄 𝙿𝚁𝙸𝙽𝙲𝙸𝙿𝙰𝙻'
const category = (name) => `┣━━〔 ${textToStylist(name.toUpperCase(), 'mono')} 〕━━━━━━━━━━`
const commandLine = (name) => `┃  ⟡ ${textToStylist(name.toUpperCase(), 'mono')}`

bot(
  {
    pattern: 'help ?(.*)',
    dontAddCommandList: true,
  },
  async (message, match, ctx) => {
    const sorted = ctx.commands
      .slice()
      .sort((a, b) => (a.name && b.name ? a.name.localeCompare(b.name) : 0))
    const [date, time] = getDate()
    const CMD_HELP = [
      lang.plugins.menu.help.format(
        ctx.PREFIX,
        message.pushName,
        time,
        date.toLocaleString('en', { weekday: 'long' }),
        date.toLocaleDateString('hi'),
        ctx.VERSION,
        ctx.pluginsCount,
        getRam(),
        getUptime('t'),
        getPlatform()
      ),
      `╭━━━〔 ${BRAND} 〕━━━╮`,
      `┃  ${title}`,
    ]
    sorted.forEach((command, i) => {
      if (!command.dontAddCommandList && command.pattern !== undefined) {
        CMD_HELP.push(`┃  ${i + 1} ${addSpace(i + 1, sorted.length)}${textToStylist(command.name.toUpperCase(), 'mono')}`)
      }
    })
    CMD_HELP.push(`╰━━━〔 ${BRAND} 〕━━━╯`)
    return await message.send(CMD_HELP.join('\n'))
  }
)

bot(
  {
    pattern: 'list ?(.*)',
    dontAddCommandList: true,
  },
  async (message, match, ctx) => {
    const sorted = ctx.commands
      .slice()
      .sort((a, b) => (a.name && b.name ? a.name.localeCompare(b.name) : 0))
    const commandList = sorted
      .filter((command) => !command.dontAddCommandList && command.pattern !== undefined)
      .map((command) => `- *${command.name}*\n${command.desc}\n`)
      .join('\n')
    await message.send(commandList)
  }
)

bot(
  {
    pattern: 'menu ?(.*)',
    dontAddCommandList: true,
  },
  async (message, match, ctx) => {
    const commands = {}
    ctx.commands.forEach((command) => {
      if (!command.dontAddCommandList && command.pattern !== undefined) {
        const cmdType = command.type.toLowerCase()
        if (!commands[cmdType]) commands[cmdType] = []
        const isDisabled = command.active === false
        const cmd = command.name.trim()
        commands[cmdType].push(isDisabled ? `${cmd} [${lang.plugins.menu.disabled}]` : cmd)
      }
    })
    const sortedCommandKeys = Object.keys(commands).sort()
    const [date, time] = getDate()
    let msg = `╭━━━〔 ${BRAND} 〕━━━╮\n┃  ${title}\n┃`
    msg += `\n┃  ${textToStylist('DATE', 'mono')}: ${date.toLocaleDateString('fr-FR')}`
    msg += `\n┃  ${textToStylist('TIME', 'mono')}: ${time}`
    msg += '\n┃'

    if (match && commands[match.toLowerCase()]) {
      msg += `\n${category(match.toLowerCase())}\n┃\n`
      commands[match.toLowerCase()].sort((a, b) => a.localeCompare(b)).forEach((plugin) => {
        msg += `${commandLine(plugin)}\n`
      })
      msg += `╰━━━〔 ${BRAND} 〕━━━╯`
      return await message.send(msg)
    }

    for (const command of sortedCommandKeys) {
      msg += `\n${category(command)}\n┃\n`
      commands[command].sort((a, b) => a.localeCompare(b)).forEach((plugin) => {
        msg += `${commandLine(plugin)}\n`
      })
    }
    msg += `╰━━━〔 ${BRAND} 〕━━━╯`
    await message.send(msg.trim())
  }
)
