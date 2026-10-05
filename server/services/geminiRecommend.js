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
 * Curated seed queries matching top trending Vietnamese rappers & singers
 * (used as instant fallback if Gemini is offline or rate-limited)
 */
export const DEFAULT_SEED_QUERIES = [
  { query: 'HIEUTHUHAI Trinh', title: 'Trình', artist: 'HIEUTHUHAI' },
  { query: 'SOOBIN Gia Nhu', title: 'Giá Như', artist: 'SOOBIN' },
  { query: 'Quang Hung MasterD Thuy Trieu', title: 'Thủy Triều', artist: 'Quang Hùng MasterD' },
  { query: 'RHYDER Sau Con Suy', title: 'Sau Cơn Suy', artist: 'RHYDER' },
  { query: 'Low G Hop On Da Show', title: 'Hop On Da Show', artist: 'Low G' },
  { query: 'tlinh dung lam no roi', title: 'Đừng Làm Nó Rơi', artist: 'tlinh' },
  { query: 'Dangrangto xuong rong', title: 'Xương Rồng', artist: 'Dangrangto' },
  { query: 'HURRYKNG di ve nha', title: 'Đi Về Nhà', artist: 'HURRYKNG' },
  { query: 'Phap Kieu DOC', title: 'DOC', artist: 'Pháp Kiều' },
  { query: 'Negav Catch Me If You Can', title: 'Catch Me If You Can', artist: 'Negav' },
  { query: 'Phuong My Chi Bong Phu Hoa', title: 'Bóng Phù Hoa', artist: 'Phương Mỹ Chi' },
  { query: 'Duc Phuc Ngay Dau Tien', title: 'Ngày Đầu Tiên', artist: 'Đức Phúc' },
  { query: 'Hoa Minzy Thi Mau', title: 'Thị Mầu', artist: 'Hòa Minzy' },
  { query: 'Vu Buoc Qua Mua Co Don', title: 'Bước Qua Mùa Cô Đơn', artist: 'Vũ.' },
  { query: 'Anh Trai Say Hi Ngon Lua Dem', title: 'Ngọn Lửa Đêm', artist: 'Anh Trai Say Hi' },
  { query: 'HIEUTHUHAI Exit Sign', title: 'Exit Sign', artist: 'HIEUTHUHAI' },
  { query: 'tlinh Yeu La Tha Thu', title: 'Yêu Là Tha Thứ', artist: 'tlinh' },
  { query: 'Rhymastic Yeu 5', title: 'Yêu 5', artist: 'Rhymastic' },
  { query: 'Captain Boy Luc Nho Nhat', title: 'Lúc Nhớ Nhất', artist: 'Captain Boy' },
  { query: 'Phuong Ly Khong Phai Em', title: 'Không Phải Em', artist: 'Phương Ly' }
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

  const prompt = `Bạn là chuyên gia âm nhạc Việt Nam.
Thị trường âm nhạc Việt Nam hiện nay ghi nhận sự bứt phá mạnh mẽ từ các show truyền hình thực tế (như Anh Trai Say Hi, Anh Trai Vượt Ngàn Chông Gai, Rap Việt) cùng các album cá nhân chất lượng cao.
Các nghệ sĩ tiêu biểu đang dẫn đầu xu hướng gồm:
- Hit-makers & Ca sĩ đa năng: HIEUTHUHAI, SOOBIN, Quang Hùng MasterD, RHYDER
- Rapper nổi tiếng: Low G, tlinh, Rhymastic, Dangrangto & DONAL, HURRYKNG, Negav, Pháp Kiều, Captain Boy
- Ca sĩ Pop/Ballad: Phương Mỹ Chi, Hòa Minzy, Đức Phúc, Phùng Khánh Linh, Vũ.
- Nhóm nhạc & show: Anh Trai Say Hi cast, Rap Việt mùa 4, Underground Việt Nam

Hãy liệt kê danh sách 50 bài hát/hit đang thịnh hành và viral nhất của các nghệ sĩ trên, bao gồm đa dạng thể loại (rap, pop, ballad, indie, r&b).
Mỗi bài hát gồm:
- "query": Cụm từ tìm kiếm ngắn gọn gồm "Tên nghệ sĩ + Tên bài hát" (ví dụ: "HIEUTHUHAI Trình", "SOOBIN Giá Như")
- "title": Tên bài hát chính xác
- "artist": Tên nghệ sĩ

Định dạng trả về duy nhất là JSON array:
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
 * Resolve queries into playable YouTube tracks.
 * Each query yields up to 2 results, targeting ~100 total tracks from 50 queries.
 */
async function resolveQueriesToTracks(queryItems) {
  const resolvedTracks = [];
  const seenIds = new Set();

  for (const item of queryItems) {
    try {
      const q = item.query || `${item.artist} ${item.title}`.trim();
      const res = await searchYouTube(q, 3, 1);
      const items = res?.items || [];
      let added = 0;
      for (const track of items) {
        if (!track || !track.id || seenIds.has(track.id)) continue;
        seenIds.add(track.id);
        resolvedTracks.push({
          ...track,
          aiRecommended: true
        });
        added++;
        if (added >= 2) break;
      }
    } catch (err) {
      console.warn(`[GeminiRecommend] Search error for "${item.query}":`, err.message);
    }
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
