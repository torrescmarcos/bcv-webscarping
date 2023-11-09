import moment from 'moment-timezone'
import { kv } from '@vercel/kv'
const axios = require('axios')
const cheerio = require('cheerio')
const https = require('https')

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
})

// configurar moment a venezuela
moment.tz.setDefault('America/Caracas')

export default async function handler (req, res) {
  if (req.method === 'GET') return getTasaOffline(req, res)

  if (req.method === 'POST') return getTasaOffline(req, res)

  return res.status(401).end()
}

const getTasaOffline = async (req, res) => {
  // recuperar parametro user
  const fechaActual = moment().format('YYYY-MM-DD HH:mm:ss')
  const fechaGuardada = await kv.get('fecha')
  if (moment(fechaGuardada).isBefore(fechaActual)) {
    const tasa = await webScraping()
    if (tasa !== null) {
      await updateTasaOffline(tasa)
    }
  }
  const tasa = await kv.get('tasa')

  res.status(201).json({ tasa: tasa || 0.00, fechaGuardada, fechaActual })
}

const updateTasaOffline = async (newTasa) => {
  try {
    await kv.set('tasa', Number(newTasa))
    // agregarle una hora a la fecha actual
    await kv.set('fecha', moment().add(1, 'hours').format('YYYY-MM-DD HH:mm:ss'))
  } catch (error) {
    console.log('🚀 ~ error:', error)
  }
}

const webScraping = async () => {
  const tasa = await axios
    .get('http://www.bcv.org.ve/', { httpsAgent })
    .then((res) => {
      const $ = cheerio.load(res.data)
      const string = $('div#dolar').text()
      let limpio = string.replace(/\s+/g, '')
      limpio = limpio.replace('USD', '')
      limpio = limpio.replace(',', '.')
      limpio = Number(limpio)
      console.log('obtenida tasa del bcv: ', limpio)
      return limpio
    })
    .catch((e) => {
      console.error('SIN CONEXION A BCV')
      return null
    })
  return tasa
}
