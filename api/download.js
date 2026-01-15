import axios from 'axios';

const delay = ms => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url, type = 'video' } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        // Step 1: Request ke Proxy
        const { data } = await axios.post('https://ytdown.to/proxy.php', 
            new URLSearchParams({ url }), 
            { 
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
                } 
            }
        );

        const api = data.api;
        if (!api || !api.mediaItems) {
            return res.status(400).json({ error: 'Gagal mendapatkan data video. Pastikan link YouTube valid.' });
        }

        const media = api.mediaItems.find((m) => m.type.toLowerCase() === type.toLowerCase());
        if (!media) {
            return res.status(404).json({ error: 'Tipe media (audio/video) tidak ditemukan.' });
        }

        // Step 2: Polling dengan batas waktu ketat (Vercel limit 10s)
        // Kita hanya coba 2 kali dengan delay pendek agar total < 10 detik
        let attempts = 0;
        while (attempts < 3) {
            const { data: resData } = await axios.get(media.mediaUrl);

            if (resData.error === 'METADATA_NOT_FOUND') {
                return res.status(404).json({ error: 'Metadata tidak ditemukan.' });
            }

            if (resData.percent === 'Completed' && resData.fileUrl && resData.fileUrl !== 'In Processing...') {
                return res.status(200).json({
                    info: {
                        title: api.title,
                        thumbnail: api.imagePreviewUrl,
                        quality: media.mediaQuality,
                        size: media.mediaFileSize,
                    },
                    download: resData.fileUrl,
                });
            }

            attempts++;
            await delay(2000); // Tunggu 2 detik saja
        }

        // Jika masih processing setelah 3 kali coba
        return res.status(202).json({ 
            error: 'File sedang diproses sistem. Silakan klik tombol download lagi dalam beberapa detik.' 
        });

    } catch (error) {
        console.error("Backend Error:", error.message);
        res.status(500).json({ error: 'Terjadi kesalahan pada server: ' + error.message });
    }
}
