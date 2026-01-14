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
        const { data } = await axios.post('https://ytdown.to/proxy.php', 
            new URLSearchParams({ url }), 
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const api = data.api;
        if (!api || !api.mediaItems) throw new Error('Invalid response from provider');

        const media = api.mediaItems.find((m) => m.type.toLowerCase() === type.toLowerCase());
        if (!media) throw new Error('Media type not found');

        
        let attempts = 0;
        while (attempts < 10) {
            const { data: resData } = await axios.get(media.mediaUrl);

            if (resData.error === 'METADATA_NOT_FOUND') throw new Error('Metadata not found');

            if (resData.percent === 'Completed' && resData.fileUrl !== 'In Processing...') {
                return res.status(200).json({
                    info: {
                        title: api.title,
                        desc: api.description,
                        thumbnail: api.imagePreviewUrl,
                        views: api.mediaStats?.viewsCount,
                        uploader: api.userInfo?.name,
                        quality: media.mediaQuality,
                        duration: media.mediaDuration,
                        extension: media.mediaExtension,
                        size: media.mediaFileSize,
                    },
                    download: resData.fileUrl,
                });
            }

            attempts++;
            await delay(3000); 
        }

        throw new Error('Timeout: File still processing. Try again later.');

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
}
