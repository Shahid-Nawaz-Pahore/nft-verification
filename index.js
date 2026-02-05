import express from 'express';
import dotenv from 'dotenv';
import { OpenSeaAPI } from 'opensea-js/lib/api/index.js';
import { Chain } from 'opensea-js/lib/types.js';

dotenv.config();

// --------------------
// Config
// --------------------
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;
const COLLECTION_SLUG = process.env.COLLECTION_SLUG || 'hamieverse-genesis';
const CHAIN = (process.env.CHAIN || 'abstract').toLowerCase();
const PORT = parseInt(process.env.PORT || '3000', 10);

if (!OPENSEA_API_KEY) {
  console.error('Missing OPENSEA_API_KEY environment variable. Set it in .env');
  process.exit(1);
}

const CHAIN_ENUM = Object.values(Chain).includes(CHAIN) ? CHAIN : Chain.Mainnet;

// OpenSea API client (read-only)
const opensea = new OpenSeaAPI({
  apiKey: OPENSEA_API_KEY,
  chain: CHAIN_ENUM,
});

// CardId -> Character mapping (slug used by frontend redirect)
// CardId here matches the NFT identifier directly.
const CARD_MAP = {
  '2': { name: 'Hamie- Cinders of Power', slug: 'hamie-cinders-of-power' },
  '4': { name: 'Kael- The Mighty', slug: 'kael-the-mighty' },
  '6': { name: "Elyndor -  Observer's Touch", slug: 'elyndor-observers-touch' },
  '7': { name: 'Simba- Quiet Companion', slug: 'simba-quiet-companion' },
  '9': { name: 'Ace Havoc', slug: 'ace-havoc' },
  '12': { name: 'Caligo- Midnight Strike', slug: 'caligo-midnight-strike' },
  '15': { name: 'Hikari- Hack Jester', slug: 'hikari-hack-jester' },
  '16': { name: 'Echo - Whisper', slug: 'echo-whisper' },
  '17': { name: 'Lost Sentinel - Forgotten Guardian', slug: 'lost-sentinel-forgotten-guardian' },
  '18': { name: 'Halo- Whispered Omens', slug: 'halo-whispered-omens' },
  '19': { name: 'Veylor Quann', slug: 'veylor-quann' },
  '21': { name: 'Orrien', slug: 'orrien' },
  '22': { name: 'Lira Velvet Strings', slug: 'lira-velvet-strings' },
  '24': { name: 'Kai Vox- Killzone Warden', slug: 'kai-vox-killzone-warden' },
  '25': { name: 'Malvoria- Time Leech', slug: 'malvoria-time-leech' },
  '26': { name: 'IronPaw Commander', slug: 'ironpaw-commander' },
  '28': { name: 'Kira Flux', slug: 'kira-flux' },
  '32': { name: 'Sam- The Insider', slug: 'sam-the-insider' },
  '101': { name: 'Alistair Veynar- The Shadows Remain', slug: 'alistair-veynar-the-shadows-remain' },
  '104': { name: 'Silas - Veiled Devotion', slug: 'silas-veiled-devotion' },
};

// --------------------
// Init
// --------------------
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// Accept raw text bodies (e.g., Postman set to text/plain) and JSON-parse them below.
app.use(express.text({ type: '*/*', limit: '1mb' }));

// Graceful JSON parse errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON body.',
      },
    });
  }
  return next(err);
});

// --------------------
// Helpers
// --------------------
function isValidWallet(address) {
  return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address);
}

function parseRequestBody(req) {
  if (req.body == null) return null;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (err) {
      return null;
    }
  }
  if (typeof req.body === 'object') return req.body;
  return null;
}

async function fetchNftsByAccount(address) {
  // Grab up to 50 NFTs for the account and filter by collection slug locally.
  const { nfts = [] } = await opensea.getNFTsByAccount(address, 50, undefined, CHAIN_ENUM);
  return { nfts: nfts.filter((nft) => nft.collection === COLLECTION_SLUG) };
}

// --------------------
// Routes
// --------------------
app.get('/health', (_, res) => res.json({ ok: true }));

app.post('/api/reveal', async (req, res) => {
  try {
    const body = parseRequestBody(req);
    if (!body || typeof body !== 'object') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Body must be JSON with a wallet field.',
        },
      });
    }

    const { wallet } = body;

    // 1. Validate wallet
    if (!wallet || !isValidWallet(wallet)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_WALLET',
          message: 'Please enter a valid wallet address.',
        },
      });
    }

    // 2. Fetch NFTs from OpenSea
    const data = await fetchNftsByAccount(wallet);
    console.log(`[reveal] fetched ${data.nfts.length} NFTs for wallet ${wallet}`);
    console.log(`[reveal] NFTs: ${JSON.stringify(data.nfts)}`);
    const nfts = data?.nfts || [];

    // 3. Ownership checks
    if (nfts.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_NFT_FOUND',
          message: 'No NFT from this collection was found in this wallet.',
        },
      });
    }

    if (nfts.length > 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MULTIPLE_NFTS_FOUND',
          message: 'Multiple NFTs from this collection were found in this wallet.',
        },
      });
    }

    // 4. Extract tokenId
    const tokenId = nfts[0].identifier;
    const cardId = tokenId; // In this collection, tokenId equals cardId

    // 5. Map cardId -> character
    const character = CARD_MAP[cardId];
    if (!character) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CARD_MAPPING_NOT_FOUND',
          message: 'Character mapping missing for this card.',
        },
      });
    }

    // 6. Success response
    return res.json({
      success: true,
      tokenId,
      cardId,
      character: character.name,
      redirectUrl: `/reveal/${character.slug}`,
    });
  } catch (err) {
    console.error('[reveal] error', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
    });
  }
});

// --------------------
// Start server
// --------------------
app.listen(PORT, () => {
  console.log(`Reveal API running on port ${PORT}`);
});
