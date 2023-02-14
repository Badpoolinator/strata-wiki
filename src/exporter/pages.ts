import { Slug } from '../common/slug';
import { Article, GamesCategoryArray, Index, Menu, MenuCategoryItem } from '../common/types';
import fs from 'fs-extra';
import { Exporter } from './export';

export class PageHandler {
    private exporter: Exporter;

    menu: Menu;
    index: Index;
    allArticles: Article[] = [];
    games: GamesCategoryArray[];

    constructor(exporter) {
        this.exporter = exporter;

        this.games = fs
            .readdirSync('pages')
            .filter((game) => fs.existsSync(`pages/${game}/meta.json`))
            .map((game) => ({
                ...fs.readJSONSync(`pages/${game}/meta.json`),
                id: game
            }));
    }

    buildIndex() {
        const index = {};
        const menu = {};

        for (const game of this.games) {
            index[game.id] = {
                id: game.id,
                meta: game,
                categories: {}
            };

            menu[game.id] = {};

            for (const category of game.categories) {
                index[game.id].categories[category.id] = {
                    id: category.id,
                    meta: category,
                    topics: {}
                };

                const menuCategory: MenuCategoryItem[] = [];

                for (const topic of category.topics) {
                    // Check if index.md exists
                    const directoryPath = new Slug(`${game.id}/${category.id}/${topic.id}`).path.replace(
                        'index.md',
                        ''
                    );

                    index[game.id].categories[category.id].topics[topic.id] = {
                        id: topic.id,
                        meta: topic,
                        articles: {}
                    };

                    // Add topic to menu
                    menuCategory.push({
                        type: 'topic',
                        id: topic.id,
                        text: topic.name,
                        link: `${game.id}/${category.id}/${topic.id}`
                    });

                    console.log('Reading directory', directoryPath);

                    const articles = fs.readdirSync(directoryPath);
                    for (let articleString of articles) {
                        articleString = articleString.replace('.md', '');

                        const result = this.exporter.renderer.renderPage(
                            new Slug(`${game.id}/${category.id}/${topic.id}/${articleString}`)
                        );

                        const meta = result.meta;
                        if (
                            Array.isArray(meta.features) &&
                            meta.features.length > 0 &&
                            !meta.features.every((feature) => this.games[game.id]?.features.includes(feature))
                        )
                            continue;

                        const article: Article = {
                            id: articleString,
                            content: result.content,
                            title: meta.title || articleString,
                            slug: result.slug,
                            file: directoryPath + articleString + '.md',
                            meta: meta
                        };

                        // Add article to index
                        index[game.id].categories[category.id].topics[topic.id].articles[articleString] = article;

                        // Add to menu
                        menuCategory.push({
                            type: 'article',
                            id: topic.id + '_' + articleString,
                            text: meta.title || articleString,
                            link: result.slug.toString()
                        });

                        // Add to collection of all articles
                        this.allArticles.push(article);
                    }
                }

                menu[game.id][category.id] = menuCategory;
            }
        }

        fs.writeFileSync('public/ajax/menu.json', JSON.stringify(menu));

        this.menu = menu as Menu;
        this.index = index as Index;
    }

    /**
     * Saves an article to the right directories
     * @param {Object} article The article object
     */
    savePage(article: Article): void {
        const path = article.slug.toString().split('/').slice(0, -1).join('/');

        // Writing JSON meta to file
        console.log('public/ajax/article/' + path);
        fs.mkdirSync('public/ajax/article/' + path, { recursive: true });
        fs.writeFileSync('public/ajax/article/' + path + '/' + article.id + '.json', JSON.stringify(article));

        // Writing HTML to file
        console.log('public/' + path);
        fs.mkdirSync('public/' + path, { recursive: true });
        fs.writeFileSync(
            'public/' + path + '/' + article.id + '.html',
            this.exporter.templater.applyTemplate({
                html: article.content,
                slug: article.slug,
                title: article.title,
                file: article.file.slice(5)
            })
        );
    }
}