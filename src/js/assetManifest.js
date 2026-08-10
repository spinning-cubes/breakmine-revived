// Single source of truth for every asset the game actually uses.
//
// All keys are relative to src/resources/ (the keys of `base64Assets` in
// src/resources.js). scripts/build-assets.js embeds ONLY the files listed
// here, and the game code below imports the same lists to decide what to
// load — so the bundle can never grow stale assets that nothing uses.
//
// NOTE: this file is pure data (no DOM / THREE / Node imports) so it can be
// imported both by the browser bundle and by the Node build script.

// ---------------------------------------------------------------------------
// UI textures (Start.js preloads these into Minecraft.resources)
// ---------------------------------------------------------------------------
export const uiTextures = [
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
];

// ---------------------------------------------------------------------------
// Texture atlas block/item textures (TextureAtlas.getTextureFiles)
// ---------------------------------------------------------------------------
export const atlasBlockTextures = [
    "stone.png", "dirt.png", "grass_top.png", "grass_side.png", "cobblestone.png",
    "oak_planks.png", "bedrock.png", "sand.png", "gravel.png", "log_oak.png",
    "log_oak_top.png", "leaves_oak_opaque.png", "glass.png", "water_still.png",
    "torch_on.png", "grass_path_top.png", "grass_path_side.png", "coal_ore.png",
    "iron_ore.png", "diamond_ore.png", "emerald_ore.png", "gold_ore.png",
    "iron_block.png", "gold_block.png", "diamond_block.png", "emerald_block.png",
    "coal_block.png", "crafting_table_top.png", "crafting_table_side.png",
    "crafting_table_front.png", "chest_bottom.png", "chest_side.png",
    "chest_front.png", "missing.png", "brick.png", "furnace_front.png",
    "furnace_front_on.png", "furnace_side.png", "furnace_top.png", "bush.png",
    "bush2.png", "bush3.png", "destroy_stage_0.png", "destroy_stage_1.png",
    "destroy_stage_2.png", "destroy_stage_3.png", "destroy_stage_4.png",
    "destroy_stage_5.png", "destroy_stage_6.png", "destroy_stage_7.png",
    "destroy_stage_8.png", "destroy_stage_9.png", "oak_leaves.png", "oak_log.png",
    "oak_log_top.png", "white_wool.png", "orange_wool.png", "magenta_wool.png",
    "light_blue_wool.png", "yellow_wool.png", "lime_wool.png", "pink_wool.png",
    "gray_wool.png", "light_gray_wool.png", "cyan_wool.png", "purple_wool.png",
    "blue_wool.png", "brown_wool.png", "green_wool.png", "red_wool.png",
    "black_wool.png", "tan_wool.png", "lava.png", "logic.png",
    "mossy_cobblestone.png", "spruce_planks.png", "birch_planks.png",
    "jungle_planks.png", "acacia_planks.png", "spruce_log.png",
    "spruce_log_top.png", "birch_log.png", "birch_log_top.png", "jungle_log.png",
    "jungle_log_top.png", "acacia_log.png", "acacia_log_top.png", "beans.png",
    "moldy_beans.png", "redstone_dust_dot.png", "redstone_dust_line.png",
    "redstone_dust_line0.png", "redstone_dust_line1.png", "redstone_dust_cross.png",
    "redstone_dust_overlay.png", "none.png", "sapphire_ore.png", "sapphire_block.png",
    "bluestone_ore.png", "slime_block_nontransparent.png", "wire.png",
    "stonebrick.png", "dark_stonebrick.png", "oak_door_top.png", "oak_door_bottom.png",
    "bluestoneBlock.png", "bluestoneDust0000.png", "bluestoneDust0001.png",
    "bluestoneDust0010.png", "bluestoneDust0011.png", "bluestoneDust0100.png",
    "bluestoneDust0101.png", "bluestoneDust0110.png", "bluestoneDust0111.png",
    "bluestoneDust1000.png", "bluestoneDust1001.png", "bluestoneDust1010.png",
    "bluestoneDust1011.png", "bluestoneDust1100.png", "bluestoneDust1101.png",
    "bluestoneDust1110.png", "bluestoneDust1111.png", "bluestoneLampOff.png",
    "bluestoneLampOn.png", "bluestoneBulbOff.png", "bluestoneBulbOn.png",
    "bluestonePusherOn.png", "bluestonePusherOff.png", "bluestoneStickyPusherOff.png",
    "piston_top_sticky.png", "cobblestone_frame.png", "cobblestone_frame_on.png",
    "bluestoneRepeaterFront.png", "bluestoneRepeaterBack.png",
    "bluestoneObserverFront.png", "bluestoneObserverBackOn.png",
    "bluestoneObserverBackOff.png", "oak_planks_green.png", "oak_planks_sticky.png",
    "bluestoneRepeaterTopOff.png", "bluestoneRepeaterTopOn.png", "lever.png",
    "cobblestone_lever_base.png"
];

const toolMaterials = ['wooden', 'stone', 'iron', 'diamond', 'golden'];
const toolTypes = ['pickaxe', 'sword', 'shovel', 'axe', 'hoe'];

export const atlasItemTextures = [
    "apple.png", "bread.png", "stick.png", "iron_ingot.png", "coal.png",
    "diamond.png", "emerald.png", "gold_ingot.png", "bucket.png",
    "water_bucket.png", "lava_bucket.png", "oak_sign.png", "oak_door.png",
    ...toolMaterials.flatMap(mat => toolTypes.map(type => `${mat}_${type}.png`))
];

// ---------------------------------------------------------------------------
// Music tracks grouped by category (MusicManager.loadTracks)
// ---------------------------------------------------------------------------
export const musicTracks = {
    menu: [
        "sound/music/menu/menu1.ogg",
        "sound/music/menu/menu2.ogg",
        "sound/music/menu/menu3.ogg",
        "sound/music/menu/menu4.ogg",
    ],
    game: [
        "sound/music/game/calm1.ogg",
        "sound/music/game/calm2.ogg",
        "sound/music/game/calm3.ogg",
        "sound/music/game/hal1.ogg",
        "sound/music/game/hal2.ogg",
        "sound/music/game/hal3.ogg",
        "sound/music/game/hal4.ogg",
        "sound/music/game/nuance1.ogg",
        "sound/music/game/nuance2.ogg",
        "sound/music/game/piano1.ogg",
        "sound/music/game/piano2.ogg",
        "sound/music/game/piano3.ogg",
    ],
    creative: [
        "sound/music/game/creative/creative1.ogg",
        "sound/music/game/creative/creative2.ogg",
        "sound/music/game/creative/creative3.ogg",
        "sound/music/game/creative/creative4.ogg",
        "sound/music/game/creative/creative5.ogg",
        "sound/music/game/creative/creative6.ogg",
    ],
    nether: [
        "sound/music/game/nether/nether1.ogg",
        "sound/music/game/nether/nether2.ogg",
        "sound/music/game/nether/nether3.ogg",
        "sound/music/game/nether/nether4.ogg",
    ],
    end: [
        "sound/music/game/end/boss.ogg",
        "sound/music/game/end/credits.ogg",
        "sound/music/game/end/end.ogg",
    ],
};

// ---------------------------------------------------------------------------
// Sound pools (SoundManager loads `sound/<name.replace('.','/')><n>.ogg` for
// n = 1..6 plus the unnumbered fallback). The `step.*` pools mirror
// Block.sounds in BlockRegistry.create(); keep them in sync.
// ---------------------------------------------------------------------------
export const soundPools = [
    "step.stone",
    "step.wood",
    "step.gravel",
    "step.grass",
    "step.cloth",
    "step.sand",
    "step.leaves",
    "random.pop",
    "random.glass",
    "random.grass",
    "random.door_open",
    "random.door_close",
    "random.eat",
    "random.fallbig",
    "random.fallsmall",
    "random.fire_hurt",
    "random.hit",
];

export const clickSound = "sound/random/click.ogg";
