import fs from 'fs';
import axios from 'axios';
import config from '../config.js';

(async () => {
    axios.defaults.headers.get['Cookie'] = config.cookie;
    const list = await axios.get('https://www.ondonnedesnouvelles.com/spaces/list');
    const journal = list.data.spaces.find((e) => e.id === config.id);
    const articles = await axios.get(journal.enter_link+'/list');
    const total = articles.data.total;
    const per_page = articles.data.per_page;
    let id = 1;
    for (let i = Math.ceil(total/per_page); i >= 1; i--) {
        const page = await axios.get(journal.enter_link+'/list?page='+i);
        const pageData = page.data.data.reverse();
        for (let j = 0; j < pageData.length; j++) {
            const title = pageData[j].title.replaceAll('/', '-').replaceAll(':', '');
            const dir = `./data/${id} - ${title}`;
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }
            const content = pageData[j].content.replaceAll('<br />', '');
            await fs.writeFileSync(`./data/${id} - ${title}/message.txt`, content);
            console.log(`Download photos from : ${id} - ${title}`);
            for (let k = 0; k < pageData[j].files_count; k++) {
                if (pageData[j].files[k].type === 3) continue;
                const ext = pageData[j].files[k].path.split('.')[3].split('?')[0];
                if (fs.existsSync(`./data/${id} - ${title}/${k+1}.${ext}`)) {
                    continue;
                }
                await axios({
                    method: 'GET',
                    url: pageData[j].files[k].path,
                    responseType: 'stream'
                }).then(async function (res) {
                    await res.data.pipe(fs.createWriteStream(`./data/${id} - ${title}/${k+1}.${ext}`));
                });
                console.log(`Download photo ${k+1}/${pageData[j].files.length}`);
            }
            id++;
        }
    }
})();