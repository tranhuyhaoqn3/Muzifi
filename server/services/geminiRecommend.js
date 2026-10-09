import { config } from '../config.js';
import { db } from '../db.js';
import { searchYouTube } from './ytdlp.js';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const GEMINI_MODELS = [
  'gemini-flash-latest',
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'gemini-pro-latest'
];

/**
 * Curated seed queries — TOP 50 trending Vietnamese songs 2025-2026
 * Gen Z / underground / mainstream — sorted most viral first
 */
export const DEFAULT_SEED_QUERIES = [
  // === HIEUTHUHAI - vẫn đỉnh 2026 ===
  { query: 'HIEUTHUHAI 2026 moi nhat', title: 'HIEUTHUHAI mới nhất', artist: 'HIEUTHUHAI' },
  { query: 'HIEUTHUHAI NOLOVENOLIFE', title: 'NOLOVENOLIFE', artist: 'HIEUTHUHAI' },
  { query: 'HIEUTHUHAI Gerdnang', title: 'GERDNANG', artist: 'HIEUTHUHAI' },

  // === Wean - rapper Gen Z bùng nổ ===
  { query: 'Wean rapper viet nam 2025', title: 'Wean trending', artist: 'Wean' },
  { query: 'Wean Khong Can Qua Khu', title: 'Không Cần Quá Khứ', artist: 'Wean' },
  { query: 'Wean co em trong tay', title: 'Có Em Trong Tay', artist: 'Wean' },

  // === RPT MCK / MCK ===
  { query: 'RPT MCK 2025 2026', title: 'RPT MCK mới', artist: 'RPT MCK' },
  { query: 'RPT MCK tlinh Nhung Dieu Em Co The Lam', title: 'Những Điều Em Có Thể Làm', artist: 'RPT MCK & tlinh' },
  { query: 'RPT MCK Dau Biet', title: 'Đâu Biết', artist: 'RPT MCK' },

  // === tlinh ===
  { query: 'tlinh 2025 moi nhat', title: 'tlinh mới nhất', artist: 'tlinh' },
  { query: 'tlinh Dung Lam No Roi', title: 'Đừng Làm Nó Rơi', artist: 'tlinh' },
  { query: 'tlinh Co Toi Trong Do Khong', title: 'Có Tôi Trong Đó Không', artist: 'tlinh' },

  // === Dế Choắt ===
  { query: 'De Choat rap viet 2025', title: 'Dế Choắt mới nhất', artist: 'Dế Choắt' },
  { query: 'De Choat Chac Day Roi', title: 'Chắc Đây Rồi', artist: 'Dế Choắt' },

  // === Tage ===
  { query: 'Tage rapper viet 2025', title: 'Tage trending', artist: 'Tage' },
  { query: 'Tage Mot Minh Thoi', title: 'Một Mình Thôi', artist: 'Tage' },

  // === Seachains ===
  { query: 'Seachains 2025', title: 'Seachains trending', artist: 'Seachains' },
  { query: 'Seachains Buot', title: 'Buốt', artist: 'Seachains' },

  // === GDucky ===
  { query: 'GDucky Rap Viet 2025', title: 'GDucky mới nhất', artist: 'GDucky' },
  { query: 'GDucky Hoa No Roi', title: 'Hoa Nở Rồi', artist: 'GDucky' },

  // === Dangrangto & DONAL ===
  { query: 'Dangrangto DONAL Xuong Rong', title: 'Xương Rồng', artist: 'Dangrangto & DONAL' },
  { query: 'Dangrangto 2025 moi', title: 'Dangrangto mới nhất', artist: 'Dangrangto' },

  // === Low G ===
  { query: 'Low G NAYYYY 2025', title: 'NAYYYY', artist: 'Low G' },
  { query: 'Low G 2026 moi nhat', title: 'Low G mới nhất', artist: 'Low G' },

  // === Negav ===
  { query: 'Negav 2025 moi nhat', title: 'Negav mới nhất', artist: 'Negav' },
  { query: 'Negav Bac Tinh', title: 'Bạc Tình', artist: 'Negav' },

  // === Captain Boy ===
  { query: 'Captain Boy 2025 moi', title: 'Captain Boy mới nhất', artist: 'Captain Boy' },
  { query: 'Captain Boy Ban Tay Lanh', title: 'Bàn Tay Lạnh', artist: 'Captain Boy' },

  // === RHYDER ===
  { query: 'RHYDER 2025 trending', title: 'RHYDER mới nhất', artist: 'RHYDER' },
  { query: 'RHYDER Tiec Cho Em', title: 'Tiếc Cho Em', artist: 'RHYDER' },

  // === Pháp Kiều ===
  { query: 'Phap Kieu 2025 rap viet', title: 'Pháp Kiều mới nhất', artist: 'Pháp Kiều' },
  { query: 'Phap Kieu Roi Ai Se La Nguoi', title: 'Rồi Ai Sẽ Là Người', artist: 'Pháp Kiều' },

  // === Wxrdie ===
  { query: 'Wxrdie 2025 moi nhat', title: 'Wxrdie mới nhất', artist: 'Wxrdie' },
  { query: 'Wxrdie Chac Ai Do Se Den', title: 'Chắc Ai Đó Sẽ Đến', artist: 'Wxrdie' },

  // === HURRYKNG ===
  { query: 'HURRYKNG 2025 trending', title: 'HURRYKNG mới nhất', artist: 'HURRYKNG' },

  // === Quang Hùng MasterD ===
  { query: 'Quang Hung MasterD 2025 2026', title: 'Quang Hùng MasterD mới nhất', artist: 'Quang Hùng MasterD' },
  { query: 'Quang Hung MasterD Thuy Trieu', title: 'Thủy Triều', artist: 'Quang Hùng MasterD' },

  // === SOOBIN ===
  { query: 'SOOBIN 2025 moi nhat hit', title: 'SOOBIN mới nhất', artist: 'SOOBIN' },
  { query: 'SOOBIN Muon Nam', title: 'Muôn Năm', artist: 'SOOBIN' },

  // === Vũ. ===
  { query: 'Vu. 2025 indie viet trending', title: 'Vũ. mới nhất', artist: 'Vũ.' },
  { query: 'Vu. Nguoi Ta Co Nguoi Ta', title: 'Người Ta Có Người Ta', artist: 'Vũ.' },

  // === MONO ===
  { query: 'MONO singer viet 2025', title: 'MONO mới nhất', artist: 'MONO' },
  { query: 'MONO Waiting For You', title: 'Waiting For You', artist: 'MONO' },

  // === Hoàng Dũng ===
  { query: 'Hoang Dung 2025 moi nhat', title: 'Hoàng Dũng mới nhất', artist: 'Hoàng Dũng' },

  // === Phương Mỹ Chi ===
  { query: 'Phuong My Chi 2025 trending', title: 'Phương Mỹ Chi mới nhất', artist: 'Phương Mỹ Chi' },

  // === GREY D ===
  { query: 'GREY D 2025 hit moi', title: 'GREY D mới nhất', artist: 'GREY D' },

  // === Andree Right Hand ===
  { query: 'Andree Right Hand 2025', title: 'Andree Right Hand mới nhất', artist: 'Andree Right Hand' },

  // === Show thực tế 2025-2026 ===
  { query: 'Rap Viet mua 5 2025 best', title: 'Rap Việt mùa 5 hot nhất', artist: 'Rap Việt' },
  { query: 'Anh Trai Say Hi 2025 hit', title: 'Anh Trai Say Hi 2025', artist: 'Anh Trai Say Hi' },
];


/**
 * Ensure database table exists for recommendations cache
 */
function ensureDbTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gemini_recommendations (
      key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

/**
 * Query Gemini to get latest trending Vietnamese music queries
 */
export async function promptGeminiForTrendingQueries(apiKey = null) {
  const key = apiKey || config.GEMINI_API_KEY;
  if (!key) {
    console.warn('[GeminiRecommend] No GEMINI_API_KEY configured, using default seed queries');
    return DEFAULT_SEED_QUERIES;
  }

  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  const prompt = `Bạn là chuyên gia âm nhạc Việt Nam cập nhật đến ${now.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}.

Nhiệm vụ: Liệt kê 50 bài hát Việt Nam đang VIRAL và TRENDING NHẤT tính từ ${sixMonthsAgo} đến nay.

YÊU CẦU QUAN TRỌNG:
- Ưu tiên bài phát hành trong 6 tháng gần nhất (mới = ưu tiên hơn)
- Sắp xếp từ viral nhất / mới nhất xuống cũ hơn
- Bao gồm: rap (Rap Việt, underground), pop, ballad, indie, R&B
- Nghệ sĩ tiêu biểu: HIEUTHUHAI, SOOBIN, Quang Hùng MasterD, RHYDER, Dangrangto & DONAL, tlinh, Low G, Negav, Pháp Kiều, Captain Boy, Wxrdie, RPT MCK, Vũ., Hoàng Dũng, Phương Mỹ Chi, MONO, Phùng Khánh Linh, và các nghệ sĩ từ show Anh Trai Say Hi, Anh Trai Vượt Ngàn Chông Gai, Rap Việt mùa 4
- KHÔNG đưa bài phát hành trước năm 2024 trừ khi đang re-viral mạnh

Mỗi bài hát gồm:
- "query": cụm tìm kiếm ngắn "Tên nghệ sĩ + Tên bài" (ví dụ: "Dangrangto Xương Rồng", "HIEUTHUHAI NOLOVENOLIFE")
- "title": tên bài hát chính xác
- "artist": tên nghệ sĩ

Trả về DUY NHẤT JSON array (không có text khác):
[
  { "query": "...", "title": "...", "artist": "..." }
]`;

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        }),
        signal: AbortSignal.timeout(20000)
      });

      if (!res.ok) continue;

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`[GeminiRecommend] Successfully fetched ${parsed.length} trending items via ${model}`);
        return parsed.map(item => ({
          query: item.query || `${item.artist || ''} ${item.title || ''}`.trim(),
          title: item.title || '',
          artist: item.artist || ''
        })).filter(it => it.query);
      }
    } catch (err) {
      console.warn(`[GeminiRecommend] Model ${model} error:`, err.message);
    }
  }

  console.warn('[GeminiRecommend] Gemini API models unavailable, falling back to seed queries');
  return DEFAULT_SEED_QUERIES;
}


/**
 * Resolve queries into playable YouTube tracks concurrently.
 * Runs 5 searches in parallel, 8s timeout per query.
 * Each query yields up to 2 results, targeting ~100 total tracks from 50 queries.
 */
async function resolveQueriesToTracks(queryItems) {
  const CONCURRENCY = 5;
  const TIMEOUT_MS = 8000;
  const allResults = [];

  // Helper: search one query with timeout
  const searchOne = async (item) => {
    const q = item.query || `${item.artist} ${item.title}`.trim();
    try {
      const res = await Promise.race([
        searchYouTube(q, 3, 1),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS))
      ]);
      return (res?.items || []).slice(0, 2);
    } catch (err) {
      console.warn(`[GeminiRecommend] Search error for "${q}":`, err.message);
      return [];
    }
  };

  // Run in batches of CONCURRENCY
  for (let i = 0; i < queryItems.length; i += CONCURRENCY) {
    const batch = queryItems.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(batch.map(searchOne));
    for (const r of batchResults) {
      if (r.status === 'fulfilled') allResults.push(...r.value);
    }
  }

  // Deduplicate
  const seenIds = new Set();
  const resolvedTracks = [];
  for (const track of allResults) {
    if (!track || !track.id || seenIds.has(track.id)) continue;
    seenIds.add(track.id);
    resolvedTracks.push({ ...track, aiRecommended: true });
  }

  return resolvedTracks;
}

/**
 * Get cached Gemini recommendations or refresh if expired (1 week TTL)
 */
export async function getGeminiRecommendations({ force = false } = {}) {
  ensureDbTable();

  const now = Date.now();
  const row = db.prepare('SELECT data, updated_at FROM gemini_recommendations WHERE key = ?').get('trending_vietnam');

  if (!force && row) {
    const age = now - row.updated_at;
    if (age < ONE_WEEK_MS) {
      try {
        const cachedTracks = JSON.parse(row.data);
        if (Array.isArray(cachedTracks) && cachedTracks.length > 0) {
          return {
            items: cachedTracks,
            fromCache: true,
            updatedAt: row.updated_at,
            nextUpdateInDays: Math.max(1, Math.round((ONE_WEEK_MS - age) / (24 * 60 * 60 * 1000)))
          };
        }
      } catch {}
    }
  }

  console.log('[GeminiRecommend] Refreshing AI trending music recommendations (Weekly cycle)...');
  const queries = await promptGeminiForTrendingQueries();
  const tracks = await resolveQueriesToTracks(queries);

  if (tracks.length > 0) {
    db.prepare(`
      INSERT INTO gemini_recommendations (key, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `).run('trending_vietnam', JSON.stringify(tracks), now);

    return {
      items: tracks,
      fromCache: false,
      updatedAt: now,
      nextUpdateInDays: 7
    };
  }

  if (row?.data) {
    try {
      return {
        items: JSON.parse(row.data),
        fromCache: true,
        updatedAt: row.updated_at,
        nextUpdateInDays: 7
      };
    } catch {}
  }

  return { items: [], fromCache: false, updatedAt: now };
}

/**
 * Initialize 1-week recurring check scheduler
 */
export function initGeminiWeeklyScheduler() {
  ensureDbTable();

  setTimeout(async () => {
    try {
      const row = db.prepare('SELECT updated_at FROM gemini_recommendations WHERE key = ?').get('trending_vietnam');
      const now = Date.now();
      if (!row || (now - row.updated_at >= ONE_WEEK_MS)) {
        console.log('[GeminiRecommend] Initial 1-week refresh starting in background...');
        await getGeminiRecommendations({ force: true });
      } else {
        const daysLeft = Math.round((ONE_WEEK_MS - (now - row.updated_at)) / (24 * 60 * 60 * 1000));
        console.log(`[GeminiRecommend] Recommendations up to date (next auto-refresh in ~${daysLeft} days)`);
      }
    } catch (err) {
      console.warn('[GeminiRecommend] Scheduler check error:', err.message);
    }
  }, 5000);

  setInterval(async () => {
    try {
      const row = db.prepare('SELECT updated_at FROM gemini_recommendations WHERE key = ?').get('trending_vietnam');
      const now = Date.now();
      if (!row || (now - row.updated_at >= ONE_WEEK_MS)) {
        console.log('[GeminiRecommend] Weekly timer triggered: refreshing recommendations from Gemini...');
        await getGeminiRecommendations({ force: true });
      }
    } catch (err) {
      console.warn('[GeminiRecommend] Periodic refresh error:', err.message);
    }
  }, 6 * 60 * 60 * 1000);
}
