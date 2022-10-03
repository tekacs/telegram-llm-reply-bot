import type * as Td from 'tdlib-types'
import { Configuration, OpenAIApi } from 'openai'
import { Client } from 'tdl'
import { TDLib } from 'tdl-tdlib-addon'
import { getTdjson } from 'prebuilt-tdlib'
import secrets from '../secrets.json' assert { type: 'json' }

const telegramClient = new Client(new TDLib(getTdjson()), {
  apiId: parseInt(secrets.telegram.apiId),
  apiHash: secrets.telegram.apiHash,
})

const openaiConfig = new Configuration({
  apiKey: secrets.openai.apiKey,
})
const openaiClient = new OpenAIApi(openaiConfig)

async function reply(message: Td.message) {
  if (message.content._ !== 'messageText') { return }
  if (message.is_outgoing) { return }
  if (secrets.telegram.excludedChats.indexOf(message.chat_id) !== -1) { return }
  const completion = await openaiClient.createCompletion({
    model: 'text-davinci-002',
    prompt: `Reply to the message "${message.content.text.text.replaceAll('"', '\"')}" in a believable fashion`,
  })
  const choices = completion.data?.choices
  const selection = choices ? choices[0].text : null
  if (selection) {
    const sendMessageCall: Td.sendMessage = {
      _: 'sendMessage',
      chat_id: message.chat_id,
      input_message_content: {
        _: 'inputMessageText',
        text: {
          _: 'formattedText',
          text: `GPT-3 says: ${selection}`,
        }
      }
    }
    await telegramClient.invoke(sendMessageCall)
  }
}

async function onUpdate(update: Td.Update) {
  switch (update._) {
    case 'updateNewMessage':
      console.log('updateNewMessage', update.message) // log messages to make tweaking filtering criteria easier
      return reply(update.message)
  }
}

async function listen() {
  await telegramClient.connectAndLogin()
  telegramClient.on('error', console.error)
  telegramClient.on('update', onUpdate)
}

async function main() {
  await listen()
}

main().catch(console.error)
