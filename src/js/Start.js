import Minecraft from './net/minecraft/client/Minecraft.js';
import * as aesjs from '../../libraries/aes.js';
import MixinEngine from './net/minecraft/client/mixin/MixinEngine.js';
import { base64Assets } from '../resources.js';

window.addEventListener('unhandledrejection', event => {
    event.preventDefault();
});

class Start {

    loadTextures(textures) {
        let resources = [];

        return Promise.all(textures.map((texturePath) => {
            return new Promise((resolve) => {
                let image = new Image();
                
                const base64Data = base64Assets[texturePath];

                if (base64Data) {
                    image.src = base64Data;
                } else {
                    console.warn(`Missing Base64 asset for: ${texturePath}`);
                    resolve();
                    return;
                }

                image.onload = () => {
                    resources[texturePath] = image;
                    resolve();
                };

                image.onerror = () => {
                    console.warn(`Failed to decode Base64 texture: ${texturePath}`);
                    resolve();
                };
            });
        })).then(() => {
            return resources;
        });
    }

    launch(canvasWrapperId) {
        this.loadTextures([
            "misc/grasscolor.png",
            "gui/font.png",
            "gui/gui.png",
            "gui/background.png",
            "gui/icons.png",
            "terrain/terrain.png",
            "terrain/sun.png",
            "terrain/moon.png",
            "char.png",
            "gui/title/minecraft.png",
            "gui/title/background/panorama_0.png",
            "gui/title/background/panorama_1.png",
            "gui/title/background/panorama_2.png",
            "gui/title/background/panorama_3.png",
            "gui/title/background/panorama_4.png",
            "gui/title/background/panorama_5.png",
            "gui/container/creative.png",
            "gui/container/crafting_table.png",
            "gui/container/inventory.png",
            "gui/container/chest.png",
            "gui/container/furnace.png",
            "gui/container/burn_progress.png",
            "gui/container/lit_progress.png",
            "gui/RecipeBook/RecipeBook.png",
            "gui/RecipeBook/RecipeF.png",
            "gui/RecipeBook/RecipeT.png",
            "gui/RecipeBook/RecipeBook1.png",
            "gui/RecipeBook/RecipeBookGUI.png",
            "gui/heart.png",
            "gui/heartHalf.png",
            "gui/heartEmpty.png",
            "gui/ping.png",
            "terrain/pack/minecraft/textures/blocks/destroy_stage_0.png",
            "terrain/pack/minecraft/textures/blocks/destroy_stage_1.png",
            "terrain/pack/minecraft/textures/blocks/destroy_stage_2.png",
            "terrain/pack/minecraft/textures/blocks/destroy_stage_3.png",
            "terrain/pack/minecraft/textures/blocks/destroy_stage_4.png",
            "terrain/pack/minecraft/textures/blocks/destroy_stage_5.png",
            "terrain/pack/minecraft/textures/blocks/destroy_stage_6.png",
            "terrain/pack/minecraft/textures/blocks/destroy_stage_7.png",
            "terrain/pack/minecraft/textures/blocks/destroy_stage_8.png",
            "terrain/pack/minecraft/textures/blocks/destroy_stage_9.png",
            "terrain/pack/minecraft/textures/misc/shadow.png",
            "terrain/pack/minecraft/textures/blocks/oak_planks.png",
            "gui/container/creative_search.png",
            "gui/scrollbar.png",
            "gui/tabs.png",
        ]).then((resources) => {
            window.app = new Minecraft(canvasWrapperId, resources);
        });
    }
}

window.addEventListener('pageshow', function (event) {
    if (window.app) {
        if (!window.app.running) {
            window.location.reload();
        }
    } else {
        new Start().launch("canvas-container");
    }
});

export function require(module) {
    return window[module];
}