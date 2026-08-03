import BlockLog from "./type/BlockLog.js";
import BlockStone from "./type/BlockStone.js";
import BlockGrass from "./type/BlockGrass.js";
import BlockDirt from "./type/BlockDirt.js";
import BlockLeave from "./type/BlockLeave.js";
import BlockWater from "./type/BlockWater.js";
import BlockSand from "./type/BlockSand.js";
import BlockTorch from "./type/BlockTorch.js";
import Sound from "./sound/Sound.js";
import Block from "./Block.js";
import BlockWood from "./type/BlockWood.js";
import BlockStair from "./type/BlockStair.js";
import BlockBedrock from "./type/BlockBedrock.js";
import BlockGlass from "./type/BlockGlass.js";
import SoundGlass from "./sound/SoundGlass.js";
import BlockGravel from "./type/BlockGravel.js";
import BlockCobblestone from "./type/BlockCobblestone.js";
import BlockGrassPath from "./type/BlockGrassPath.js";
import BlockStoneLike from "./type/BlockStoneLike.js";
import BlockCraftingTable from "./type/BlockCraftingTable.js";
import BlockChest from "./type/BlockChest.js";
import BlockMissing from "./type/BlockMissing.js";
import BlockBrick from "./type/BlockBrick.js";
import BlockFurnace from "./type/BlockFurnace.js";
import ItemApple from "./type/ItemApple.js";
import ItemBread from "./type/ItemBread.js";
import ItemStick from "./type/ItemStick.js";
import ItemGeneric from "./type/ItemGeneric.js";
import ItemPickaxe from "./type/ItemPickaxe.js";
import ItemSword from "./type/ItemSword.js";
import ItemShovel from "./type/ItemShovel.js";
import ItemAxe from "./type/ItemAxe.js";
import ItemHoe from "./type/ItemHoe.js";
import ItemBucketWater from "./type/ItemBucketWater.js";
import ItemBucketEmpty from "./type/ItemBucketEmpty.js";
import BlockBush from "./type/BlockBush.js";
import BlockFence from "./type/BlockFence.js";
import BlockWoodPanel from "./type/BlockWoodPanel.js";
import SoundGrass from "./sound/SoundGrass.js";
import BlockWool from "./type/BlockWool.js";
import BlockLava from "./type/BlockLava.js";
import BlockLogic from "./type/BlockLogic.js";
import BlockMossyCobblestone from "./type/BlockMossyCobblestone.js";
import BlockSlab from "./type/BlockSlab.js";
import BlockBeans from "./type/BlockBeans.js";
import BlockMoldyBeans from "./type/BlockMoldyBeans.js";
import BlockWire from "./type/BlockWire.js";
import ItemBucketLava from "./type/ItemBucketLava.js";
import BlockSign from "./type/BlockSign.js";
import BlockDoor from "./type/BlockDoor.js";
import ItemDoorPlacer from "./type/ItemDoorPlacer.js";
import BlockBluestoneDust from "./type/BlockBluestoneDust.js";
import BlockBluestoneLamp from "./type/BlockBluestoneLamp.js";
import BlockBluestoneBlock from "./type/BlockBlustoneBlock.js";
import BlockBluestonePusher from "./type/BlockBluestonePusher.js";
import BlockBluestoneStickyPusher from "./type/BlockBluestoneStickyPusher.js";
import BlockBluestonePusherHead from "./type/BlockBluestonePusherHead.js";
import BlockBluestoneStickyPusherHead from "./type/BlockBluestoneStickyPusherHead.js";
import BlockBluestoneRepeater from "./type/BlockBluestoneRepeater.js";
import BlockBluestoneObserver from "./type/BlockBluestoneObserver.js";
import BlockBluestoneAdjustingLamp from "./type/BlockBluestoneAdjustingLamp.js";
import BlockBluestoneBulb from "./type/BlockBluestoneBulb.js";
import BlockBluestoneRod from "./type/BlockBluestoneRod.js";
import BlockBluestoneRodPillar from "./type/BlockBluestoneRodPillar.js";
import BlockSlime from "./type/BlockSlime.js";

export class BlockRegistry {

    static init = false;
    static DEFAULT_NAMESPACE = "breakmine";

    static registry = new Map();
    static idMap = new Map();

    static hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
        }
        return hash >>> 0;
    }

    static normalizeKey(key) {
        if (typeof key !== "string") return key;
        const strKey = key.toLowerCase();
        return strKey.includes(":") ? strKey : `${BlockRegistry.DEFAULT_NAMESPACE}:${strKey}`;
    }

    static register(identifier, block) {
        const fullKey = typeof identifier === "string"
            ? this.normalizeKey(identifier)
            : `${BlockRegistry.DEFAULT_NAMESPACE}:${block.name || block.id}`;

        const [namespace, name] = fullKey.split(":");
        const hashId = this.hashString(fullKey);

        block.identifier = fullKey;
        block.namespace = namespace;
        block.name = name || block.name;
        block.hashId = hashId;

        this.registry.set(fullKey, block);
        this.registry.set(name, block);

        if (block.id !== undefined) {
            this.idMap.set(block.id, block);
        }
        this.idMap.set(hashId, block);

        return block;
    }

    static get(key) {
        if (typeof key === "number") {
            return this.idMap.get(key) || Block.blocks.get(key);
        }
        const normalized = this.normalizeKey(key);
        return this.registry.get(normalized) || this.registry.get(key);
    }

    static unregister(identifier) {
        const fullKey = this.normalizeKey(identifier);
        const block = this.registry.get(fullKey);
        if (block) {
            this.registry.delete(fullKey);
            this.registry.delete(block.name);
            if (block.id !== undefined) this.idMap.delete(block.id);
            this.idMap.delete(block.hashId);
        }
    }

    static registerBlockClass(id, name, blockClass) {
        if (!blockClass) return null;
        const block = new blockClass(id, 0);
        block.id = BlockRegistry.hashString(id);
        return this.register(id, block);
    }

    static create() {
        Block.sounds.stone = new Sound("stone", 1.0);
        Block.sounds.wood = new Sound("wood", 1.0);
        Block.sounds.gravel = new Sound("gravel", 1.0);
        Block.sounds.grass = new SoundGrass("grass", 1.0);
        Block.sounds.cloth = new Sound("cloth", 1.0);
        Block.sounds.sand = new Sound("sand", 1.0);
        Block.sounds.glass = new SoundGlass("stone", 1.0);
        Block.sounds.leaves = new Sound("leaves", 1.0);

        BlockRegistry.STONE = new BlockStone(1, 0);
        BlockRegistry.GRASS = new BlockGrass(2, 1);
        BlockRegistry.DIRT = new BlockDirt(3, 2);
        BlockRegistry.BEDROCK = new BlockBedrock(7, 11);
        BlockRegistry.GRAVEL = new BlockGravel(13, 13);
        BlockRegistry.LEAVE = new BlockLeave(18, 6);
        BlockRegistry.GLASS = new BlockGlass(20, 12);
        BlockRegistry.WATER = new BlockWater(9, 7);
        BlockRegistry.SAND = new BlockSand(12, 8);
        BlockRegistry.TORCH = new BlockTorch(50, 9);
        BlockRegistry.GRASS_PATH = new BlockGrassPath(19, 15);

        // --- WOOD TYPES ---
        // Oak
        BlockRegistry.LOG = new BlockLog(17, 4, "oak", "Oak Log");
        BlockRegistry.WOOD = new BlockWood(5, 10, "oak", "Oak Planks");
        BlockRegistry.OAK_STAIRS = new BlockStair(150, 0, 5, "Oak");
        BlockRegistry.WOOD_SLAB = new BlockSlab(71, 0, "oak_planks", "Oak Slab", Block.sounds.wood);
        BlockRegistry.FENCE = new BlockFence(36, 0, "oak", 5);
        BlockRegistry.OAK_DOOR = new BlockDoor(160, 0);
        BlockRegistry.OAK_DOOR_TOP = new BlockDoor(161, 0);
        BlockRegistry.ITEM_OAK_DOOR_PLACER = new ItemDoorPlacer(162, 0, "Oak Door")

        // Spruce
        BlockRegistry.SPRUCE_LOG = new BlockLog(59, 0, "spruce", "Spruce Log");
        BlockRegistry.SPRUCE_PLANKS = new BlockWood(58, 0, "spruce", "Spruce Planks");
        BlockRegistry.SPRUCE_STAIRS = new BlockStair(151, 0, 58, "Spruce");
        BlockRegistry.SPRUCE_SLAB = new BlockSlab(72, 0, "spruce_planks", "Spruce Slab", Block.sounds.wood);
        BlockRegistry.SPRUCE_FENCE = new BlockFence(60, 0, "spruce", 58);

        // Birch
        BlockRegistry.BIRCH_LOG = new BlockLog(62, 0, "birch", "Birch Log");
        BlockRegistry.BIRCH_PLANKS = new BlockWood(61, 0, "birch", "Birch Planks");
        BlockRegistry.BIRCH_STAIRS = new BlockStair(152, 0, 61, "Birch");
        BlockRegistry.BIRCH_SLAB = new BlockSlab(73, 0, "birch_planks", "Birch Slab", Block.sounds.wood);
        BlockRegistry.BIRCH_FENCE = new BlockFence(63, 0, "birch", 61);

        // Jungle
        BlockRegistry.JUNGLE_LOG = new BlockLog(65, 0, "jungle", "Jungle Log");
        BlockRegistry.JUNGLE_PLANKS = new BlockWood(64, 0, "jungle", "Jungle Planks");
        BlockRegistry.JUNGLE_STAIRS = new BlockStair(153, 0, 64, "Jungle");
        BlockRegistry.JUNGLE_SLAB = new BlockSlab(74, 0, "jungle_planks", "Jungle Slab", Block.sounds.wood);
        BlockRegistry.JUNGLE_FENCE = new BlockFence(66, 0, "jungle", 64);

        // Acacia
        BlockRegistry.ACACIA_LOG = new BlockLog(68, 0, "acacia", "Acacia Log");
        BlockRegistry.ACACIA_PLANKS = new BlockWood(67, 0, "acacia", "Acacia Planks");
        BlockRegistry.ACACIA_STAIRS = new BlockStair(154, 0, 67, "Acacia");
        BlockRegistry.ACACIA_SLAB = new BlockSlab(75, 0, "acacia_planks", "Acacia Slab", Block.sounds.wood);
        BlockRegistry.ACACIA_FENCE = new BlockFence(69, 0, "acacia", 67);
        
        // --- STONE & BRICK VARIANTS ---
        // Cobblestone
        BlockRegistry.COBBLE_STONE = new BlockCobblestone(4, 14);
        BlockRegistry.COBBLESTONE_STAIRS = new BlockStair(155, 0, 4, "Cobblestone");
        BlockRegistry.COBBLESTONE_SLAB = new BlockSlab(70, 0, "cobblestone", "Cobblestone Slab", Block.sounds.stone);

        // Mossy Cobblestone
        BlockRegistry.MOSSY_COBBLESTONE = new BlockMossyCobblestone(6, 14);
        BlockRegistry.MOSSY_COBBLESTONE_STAIRS = new BlockStair(156, 0, 6, "Mossy Cobblestone");
        BlockRegistry.MOSSY_COBBLESTONE_SLAB = new BlockSlab(76, 0, "mossy_cobblestone", "Mossy Cobblestone Slab", Block.sounds.stone);

        // Bricks
        BlockRegistry.BRICK = new BlockBrick(33, 0);
        BlockRegistry.BRICK_STAIRS = new BlockStair(157, 0, 33, "Brick");
        BlockRegistry.BRICK_SLAB = new BlockSlab(77, 0, "brick", "Brick Slab", Block.sounds.stone);

        // --- ORES & MINERAL BLOCKS ---
        BlockRegistry.GOLD_ORE = new BlockStoneLike(21, 0, "gold_ore", "Gold Ore", 3.0, [21, 1], 'iron');
        BlockRegistry.DIAMOND_ORE = new BlockStoneLike(22, 0, "diamond_ore", "Diamond Ore", 3.0, [88, 1], 'iron');
        BlockRegistry.COAL_ORE = new BlockStoneLike(23, 0, "coal_ore", "Coal Ore", 3.0, [87, 2], 'wood');
        BlockRegistry.IRON_ORE = new BlockStoneLike(24, 0, "iron_ore", "Iron Ore", 3.0, [24, 1], 'stone');
        BlockRegistry.IRON_BLOCK = new BlockStoneLike(25, 0, "iron_block", "Iron Block", 3.0, [25, 0], 'stone');
        BlockRegistry.GOLD_BLOCK = new BlockStoneLike(26, 0, "gold_block", "Gold Block", 3.0, [26, 0], 'iron');
        BlockRegistry.DIAMOND_BLOCK = new BlockStoneLike(27, 0, "diamond_block", "Diamond Block", 3.0, [27, 0], 'iron');
        BlockRegistry.EMERALD_BLOCK = new BlockStoneLike(28, 0, "emerald_block", "Emerald Block", 3.0, [28, 0], 'iron');
        BlockRegistry.COAL_BLOCK = new BlockStoneLike(29, 0, "coal_block", "Coal Block", 3.0, [29, 0], 'wood');
        BlockRegistry.EMERALD_ORE = new BlockStoneLike(30, 0, "emerald_ore", "Emerald Ore", 3.0, [89, 1], 'iron');
        BlockRegistry.SAPPHIRE_ORE = new BlockStoneLike(81, 0, "sapphire_ore", "Sapphire Ore");
        BlockRegistry.SAPPHIRE_BLOCK = new BlockStoneLike(82, 0, "sapphire_block", "Sapphire Block");
        BlockRegistry.BLUESTONE_ORE = new BlockStoneLike(176, 0, "bluestone_ore", "Bluestone Ore", 3.0, [176, 1], 'iron');

        // --- FUNCTIONAL / MISC BLOCKS ---
        BlockRegistry.CRAFTING_TABLE = new BlockCraftingTable(31, 0);
        BlockRegistry.CHEST = new BlockChest(32, 0);
        BlockRegistry.FURNACE = new BlockFurnace(34, 0);
        BlockRegistry.BUSH = new BlockBush(35, 0);
        BlockRegistry.WOOD_PANEL = new BlockWoodPanel(37, 0);
        BlockRegistry.BEANS = new BlockBeans(78, 0);
        BlockRegistry.MOLDY_BEANS = new BlockMoldyBeans(79, 0);
        //BlockRegistry.WIRE = new BlockWire(80, 0);
        BlockRegistry.SIGN = new BlockSign(121, 0);
        BlockRegistry.LAVA = new BlockLava(55, 0);
        BlockRegistry.LOGIC = new BlockLogic(56, 0);

        // --- WOOL BLOCKS ---
        BlockRegistry.WHITE_WOOL = new BlockWool(38, 0, "white_wool", "White Wool");
        BlockRegistry.ORANGE_WOOL = new BlockWool(39, 0, "orange_wool", "Orange Wool");
        BlockRegistry.MAGENTA_WOOL = new BlockWool(40, 0, "magenta_wool", "Magenta Wool");
        BlockRegistry.LIGHT_BLUE_WOOL = new BlockWool(41, 0, "light_blue_wool", "Light Blue Wool");
        BlockRegistry.YELLOW_WOOL = new BlockWool(42, 0, "yellow_wool", "Yellow Wool");
        BlockRegistry.LIME_WOOL = new BlockWool(43, 0, "lime_wool", "Lime Wool");
        BlockRegistry.PINK_WOOL = new BlockWool(44, 0, "pink_wool", "Pink Wool");
        BlockRegistry.GRAY_WOOL = new BlockWool(45, 0, "gray_wool", "Gray Wool");
        BlockRegistry.LIGHT_GRAY_WOOL = new BlockWool(46, 0, "light_gray_wool", "Light Gray Wool");
        BlockRegistry.CYAN_WOOL = new BlockWool(47, 0, "cyan_wool", "Cyan Wool");
        BlockRegistry.PURPLE_WOOL = new BlockWool(48, 0, "purple_wool", "Purple Wool");
        BlockRegistry.BLUE_WOOL = new BlockWool(49, 0, "blue_wool", "Blue Wool");
        BlockRegistry.BROWN_WOOL = new BlockWool(54, 0, "brown_wool", "Brown Wool");
        BlockRegistry.GREEN_WOOL = new BlockWool(51, 0, "green_wool", "Green Wool");
        BlockRegistry.RED_WOOL = new BlockWool(52, 0, "red_wool", "Red Wool");
        BlockRegistry.BLACK_WOOL = new BlockWool(53, 0, "black_wool", "Black Wool");
        BlockRegistry.TAN_WOOL = new BlockWool(57, 0, "tan_wool", "Tan Wool");

        // --- ITEMS & TOOLS ---
        BlockRegistry.ITEM_APPLE = new ItemApple(83, 14);
        BlockRegistry.ITEM_BREAD = new ItemBread(84, 15);
        BlockRegistry.ITEM_STICK = new ItemStick(85, 16);

        BlockRegistry.ITEM_IRON = new ItemGeneric(86, 'iron_ingot', 'Iron Ingot');
        BlockRegistry.ITEM_COAL = new ItemGeneric(87, 'coal', 'Coal');
        BlockRegistry.ITEM_DIAMOND = new ItemGeneric(88, 'diamond', 'Diamond');
        BlockRegistry.ITEM_EMERALD = new ItemGeneric(89, 'emerald', 'Emerald');
        BlockRegistry.ITEM_GOLD = new ItemGeneric(90, 'gold_ingot', 'Gold Ingot');

        BlockRegistry.STONEBRICK = new BlockStoneLike(116, 0, "stonebrick", "Stone Bricks");
        BlockRegistry.DARK_STONEBRICK = new BlockStoneLike(117, 0, "dark_stonebrick", "Dark Stone Bricks");

        const toolMaterials = ['wood', 'stone', 'iron', 'diamond', 'gold'];
        let toolId = 91;
        for (const mat of toolMaterials) {
            const matName = mat === 'wood' ? 'Wooden' : mat.charAt(0).toUpperCase() + mat.slice(1);
            const itemName = mat === 'gold' ? 'Golden' : mat;
            const texName = mat === 'gold' ? 'golden' : mat === 'wood' ? 'wooden' : mat;
            BlockRegistry[`${mat.toUpperCase()}_PICKAXE`] = new ItemPickaxe(toolId++, `${texName}_pickaxe`, `${matName} Pickaxe`, mat);
            BlockRegistry[`${mat.toUpperCase()}_SWORD`] = new ItemSword(toolId++, `${texName}_sword`, `${matName} Sword`, mat);
            BlockRegistry[`${mat.toUpperCase()}_SHOVEL`] = new ItemShovel(toolId++, `${texName}_shovel`, `${matName} Shovel`, mat);
            BlockRegistry[`${mat.toUpperCase()}_AXE`] = new ItemAxe(toolId++, `${texName}_axe`, `${matName} Axe`, mat);
            BlockRegistry[`${mat.toUpperCase()}_HOE`] = new ItemHoe(toolId++, `${texName}_hoe`, `${matName} Hoe`, mat);
        }

        BlockRegistry.ITEM_BUCKET_EMPTY = new ItemBucketEmpty(118, 'bucket', 'Empty Bucket');
        BlockRegistry.ITEM_BUCKET_WATER = new ItemBucketWater(119, 'water_bucket', 'Water Bucket');
        BlockRegistry.ITEM_BUCKET_LAVA = new ItemBucketLava(120, 'lava_bucket', 'Lava Bucket');

        BlockRegistry.BLUESTONE_DUST = new BlockBluestoneDust(163, 0, "bluestone_dust", "Bluestone Dust");
        BlockRegistry.BLUESTONE_LAMP = new BlockBluestoneLamp(164, 0, "bluestone_lamp", "Bluestone Lamp");
        BlockRegistry.BLUESTONE_ADJUSTING_LAMP = new BlockBluestoneAdjustingLamp(172, 0, "bluestone_adjusting_lamp", "Adjustable Bluestone Lamp");
        BlockRegistry.BLUESTONE_BULB = new BlockBluestoneBulb(173, 0, "bluestone_bulb", "Bluestone Bulb");
        BlockRegistry.BLUESTONE_ROD = new BlockBluestoneRod(174, 0, "bluestone_rod", "Bluestone Rod");
        BlockRegistry.BLUESTONE_ROD_PILLAR = new BlockBluestoneRodPillar(175, 0, "bluestone_rod_pillar", "Bluestone Rod");
        BlockRegistry.BLUESTONE_BLOCK = new BlockBluestoneBlock(165, 0, "bluestone_block", "Bluestone Block");
        BlockRegistry.BLUESTONE_PUSHER = new BlockBluestonePusher(166, 0, 167, "bluestone_pusher", "Bluestone Pusher");
        BlockRegistry.BLUESTONE_PUSHER_HEAD = new BlockBluestonePusherHead(167, 0, "bluestone_pusher_head", "Bluestone Pusher Head");
        BlockRegistry.BLUESTONE_REPEATER = new BlockBluestoneRepeater(168, 0, "bluestone_repeater", "Bluestone Repeater");
        BlockRegistry.BLUESTONE_OBSERVER = new BlockBluestoneObserver(169, 0, "bluestone_observer", "Bluestone Observer");  
        BlockRegistry.BLUESTONE_STICKY_PUSHER = new BlockBluestoneStickyPusher(170, 0, "bluestone_sticky_pusher", "Sticky Bluestone Pusher");
        BlockRegistry.BLUESTONE_STICKY_PUSHER_HEAD = new BlockBluestoneStickyPusherHead(171, 0, "bluestone_sticky_pusher_head", "Sticky Bluestone Pusher Head");
        BlockRegistry.SLIME = new BlockSlime(177, 0, "slime_block_nontransparent", "Slime Block");

        for (const [key, val] of Object.entries(BlockRegistry)) {
            if (val && typeof val === "object" && val.id !== undefined) {
                const nameKey = key.toLowerCase().replace(/^item_/, "");
                BlockRegistry.register(nameKey, val);
            }
        }

        BlockRegistry.registry.set("oak_planks", BlockRegistry.WOOD);
        BlockRegistry.registry.set("breakmine:oak_planks", BlockRegistry.WOOD);

        const originalGetById = Block.getById;
        Block.getById = function(typeId) {
            let block = originalGetById.call(this, typeId);
            if (block) return block;
            return BlockRegistry.idMap.get(typeId) || null;
        };

        BlockRegistry.init = true;
    }

    static getAllBlocks() {
        return this;
    }
}