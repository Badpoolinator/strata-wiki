import fs from 'fs-extra';
import { PageHandler } from './pages';
import { Templater } from './template';
import { Renderer } from './render';
import { Slug } from '../common/slug';

export class Exporter {
    pageHandler: PageHandler;
    templater: Templater;
    renderer: Renderer;

    constructor() {
        this.pageHandler = new PageHandler(this);
        this.templater = new Templater(this);
        this.renderer = new Renderer(this);
    }

    export() {
        let stepCount = 1;
        const step = (): void => {
            console.log(`--------------`);
            console.log(`    Step ${stepCount++}`);
            console.log(`--------------`);
        };

        const startTime = performance.now();

        step();
        this.clean();

        step();
        this.copyAssets();

        step();
        this.copyResources();

        step();
        this.templater.generateNav();

        step();
        this.pageHandler.buildIndex();

        step();
        this.saveAllPages();

        step();
        this.generateSpecialPages();

        step();
        this.copyGameMeta();

        const endTime = performance.now();

        console.log('Done!');
        console.log('Building took', Math.ceil(endTime - startTime) / 1000, 'seconds.');
    }

    clean() {
        console.log('Clearing public folder...');
        if (fs.existsSync('public')) {
            fs.rmSync('public', { recursive: true });
        }
        fs.mkdirSync('public');
        fs.mkdirSync('public/ajax');
    }

    copyAssets() {
        console.log('Copying assets...');
        fs.mkdirSync('public/assets');
        fs.copySync('../assets', 'public/assets');
    }

    copyResources() {
        console.log('Copying resources...');
        fs.copySync('static', 'public');
    }

    saveAllPages() {
        for (const gameMeta of this.pageHandler.games)
            for (const category of Object.values(this.pageHandler.index[gameMeta.id].categories))
                for (const topic of Object.values(category.topics))
                    for (const article of Object.values(topic.articles)) this.pageHandler.savePage(gameMeta, article);
    }

    copyGameMeta() {
        const games = {};

        for (const game of this.pageHandler.games) {
            console.log('Processing game', game.id);
            games[game.id] = game;
        }

        fs.writeFileSync('public/ajax/games.json', JSON.stringify(games));
    }

    generateSpecialPages() {
        for (const game of this.pageHandler.games) {
            const content = this.renderer.renderPage(`../pages/${game.id}/index.md`, new Slug(game.id));

            this.pageHandler.savePage(game, {
                ...content,
                slug: new Slug(game.id),
                title: content.meta.title || 'Home',
                file: `/pages/${game.id}/index.md`,
                id: 'index'
            });

            this.pageHandler.savePage(game, {
                ...content,
                slug: new Slug(game.id),
                title: 'Home',
                file: '',
                id: '404',
                content: fs.readFileSync('templates/404.html', 'utf8')
            });
        }
    }
}
