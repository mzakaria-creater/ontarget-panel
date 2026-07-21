function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const secretKey = process.env.SUPABASE_SECRET_KEY
    if (!supabaseUrl || !secretKey) {
      res.status(500).json({ error: 'Maven worker environment variables are missing' })
      return
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/maven-http-worker`, {
      method: 'POST',
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': req.headers['content-type'] || 'application/json',
      },
      body: await readBody(req),
    })
    res.status(response.status)
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json; charset=utf-8')
    res.send(await response.text())
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Maven worker request failed' })
  }
}
