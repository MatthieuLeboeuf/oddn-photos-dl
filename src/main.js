import fs from 'fs';
import axios from 'axios';
import config from '../config.js';

(async () => {
    axios.defaults.headers.get['Cookie'] = config.cookie;

    const list = await axios.get(config.base_url+'/spaces/list');
    const journal = list.data.spaces.find((e) => e.id === config.id);
    if (!journal) {
        console.log('Veuillez fournir un id de séjour valide !');
        process.exit(0);
    }

    const articles = await axios.get(journal.enter_link+'/list');
    const posts_count = journal.posts_count;
    const page_size = articles.data.page_size;
    let id = 1;
    for (let i = Math.ceil(posts_count/page_size); i >= 1; i--) {
        const page = await axios.get(journal.enter_link+'/list?page='+i);
        const pageData = page.data.data.reverse();

        // Check if data folder exists
        if (!fs.existsSync('./data')) {
            fs.mkdirSync('./data');
        }

        for (let j = 0; j < pageData.length; j++) {
            // Get and parse title
            const title = pageData[j].title.replaceAll('/', '-').replaceAll(':', '');

            // Create post title
            const dir = `./data/${id} - ${title}`;
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }

            // Get and parse description
            const content = pageData[j].content.replaceAll('<br />', '').replaceAll('<br>', '');
            await fs.writeFileSync(`./data/${id} - ${title}/message.txt`, content);

            console.log(`Download data from : ${id} - ${title}`);

            // get post details
            const currentData = await axios.get(journal.enter_link+'/posts/with-details/'+pageData[j].id);

            for (let k = 0; k < currentData.data.files.length; k++) {
                // Create if not exist folder with file type
                const type = currentData.data.files[k].type;
                const dir = `./data/${id} - ${title}/${type}`;
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir);
                }

                // Check if the file already exists
                const ext = currentData.data.files[k].extension;
                if (fs.existsSync(`./data/${id} - ${title}/${type}/${k+1}.${ext}`)) {
                    continue;
                }

                // If the src is youtube only create a txt with url
                if (currentData.data.files[k].src.includes('youtube.com')) {
                    const content = 'https:'+currentData.data.files[k].src;
                    await fs.writeFileSync(`./data/${id} - ${title}/${type}/${k+1}.txt`, content);
                } else {
                    // Download the file
                    await axios({
                        method: 'GET',
                        url: currentData.data.files[k].src,
                        responseType: 'stream'
                    }).then(async function (res) {
                        await res.data.pipe(fs.createWriteStream(`./data/${id} - ${title}/${type}/${k+1}.${ext}`));
                    }).catch(error => {
                        console.log(error);
                    });
                }

                // Download counter
                console.log(`Download ${type} ${k+1}/${currentData.data.files.length} - ${k+1}.${ext}`);
            }
            id++;
        }
    }
})();