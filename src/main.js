import fs from 'fs';
import axios from 'axios';
import config from '../config.js';

/**
 * Retourne un nom de répertoire valide pour Windows.
 * @param {string} raw - le titre d'origine
 * @returns {string} nom "sanitizé"
 */
function sanitizeDirName(raw) {
    const maxLen = 255;
    if (raw == null) return 'untitled';

    let name = String(raw);

    // remplacements personnalisés rapides (gardés de ton code original)
    // '/' -> '-' ; '"' -> '\'' ; ':' et '?' retirés (on gère aussi globalement plus bas)
    name = name.replaceAll('/', '-').replaceAll('"', '\'')
    // on peut laisser ces pour lisibilité ; le regex suivant nettoiera tout
    ;

    // supprimer caractères de contrôle (0x00-0x1F) et caractères interdits pour Windows filenames
    // Interdits (Windows): < > : " / \ | ? *  et les codes de contrôle
    name = name.replace(/[\x00-\x1f<>:"\/\\|?\*]/g, '');

    // enlever les points/espaces finaux (Windows n'aime pas les noms se terminant par '.' ou ' ')
    name = name.replace(/[ .]+$/u, '');

    // raccourcir si trop long en gardant la fin (ou la début si tu préfères)
    if (name.length > maxLen) {
        // coupe en gardant le début
        name = name.slice(0, maxLen);
        // après découpe, refaire suppression des points/espaces finaux au cas où
        name = name.replace(/[ .]+$/u, '');
    }

    // éviter les noms réservés Windows (cas-insensitif)
    const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
    if (reserved.test(name)) {
        name = name + '_'; // simple stratégie : ajouter un underscore
    }

    // si tout est vide, fallback
    if (name.length === 0) return 'untitled';

    return name;
}


(async () => {
    axios.defaults.headers.get['Cookie'] = config.cookie;

    const list = await axios.get(config.base_url+'/spaces/list');

    console.log(`Check for ID:${config.id} in spaces list`);
    let journal = list.data.spaces.find((e) => e.id === config.id);
    if(!journal){
        console.log(`NOT FOUND, Check for ID:${config.id} in spaces_soon_archived list`);
        if(list.data.spaces_soon_archived !== undefined) {
            journal = list.data.spaces_soon_archived.find((e) => e.id === config.id);
        }
    }
    if (!journal) {
        console.log('Veuillez fournir un id de séjour valide !');
        process.exit(0);
    }

    const articles = await axios.get(journal.enter_link+'/posts/list');
    const posts_count = journal.posts_count;
    const page_size = articles.data.page_size;
    let id = 1;
    for (let i = Math.ceil(posts_count/page_size); i >= 1; i--) {
        const page = await axios.get(journal.enter_link+'/posts/list?page='+i);
        const pageData = page.data.data.reverse();

        // Check if data folder exists
        if (!fs.existsSync('./data')) {
            fs.mkdirSync('./data');
        }

        for (let j = 0; j < pageData.length; j++) {
            // Get and parse title
            // dir name that end with ... are in error in Windows
            const title = sanitizeDirName(pageData[j].title)

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
