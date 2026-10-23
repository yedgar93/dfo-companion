# Dashboard reference artwork

These representative item icons are Bethesda's Morrowind artwork, retrieved through UESP's public media API on 2026-10-20. They illustrate item categories, not the exact DFO item, material or enchantments. Original copyright remains with its owner. UESP source pages: https://en.uesp.net/wiki/Morrowind:Steel and https://en.uesp.net/wiki/Morrowind:Books and https://en.uesp.net/wiki/Morrowind:Potions and https://en.uesp.net/wiki/Morrowind:Expensive_Clothing .

- boots.png: https://images.uesp.net/7/7e/MW-icon-armor-Steel_Boots.png
- cuirass.png: https://images.uesp.net/e/e3/MW-icon-armor-Steel_Cuirass.png
- gauntlet.png: https://images.uesp.net/1/12/MW-icon-armor-Steel_Gauntlet.png
- greaves.png: https://images.uesp.net/6/6b/MW-icon-armor-Steel_Greaves.png
- helm.png: https://images.uesp.net/8/8d/MW-icon-armor-Steel_Helm.png
- pauldron.png: https://images.uesp.net/8/8f/MW-icon-armor-Steel_Pauldron.png
- shield.png: https://images.uesp.net/2/22/MW-icon-armor-Steel_Shield.png
- sword.png: https://images.uesp.net/8/8e/MW-icon-weapon-Steel_Longsword.png
- dagger.png: https://images.uesp.net/0/03/MW-icon-weapon-Steel_Dagger.png
- mace.png: https://images.uesp.net/9/95/MW-icon-weapon-Steel_Mace.png
- axe.png: https://images.uesp.net/3/3f/MW-icon-weapon-Steel_Battle_Axe.png
- bow.png: https://images.uesp.net/0/0f/MW-icon-weapon-Short_Bow.png
- arrow.png: https://images.uesp.net/1/18/MW-icon-weapon-Steel_Arrow.png
- staff.png: https://images.uesp.net/7/77/MW-icon-weapon-Steel_Staff.png
- gold.png: https://images.uesp.net/f/f9/MW-icon-Gold.png
- book.png: https://images.uesp.net/7/7c/MW-icon-book-Book1.png
- amulet.png: https://images.uesp.net/d/d3/MW-icon-jewelry-Expensive_Amulet_01.png
- potion.png: https://images.uesp.net/1/14/MW-icon-potion-Bargain_Potion.png

The retired outfit screenshot is no longer displayed. Character and map assets are decoded from the user’s existing original game files into a local runtime cache outside this package. Bethesda retains ownership of the original artwork.

game-frame.svg and game-grain.svg reproduce the matching official DFO0.1.10435 enhanced frame and grain definitions (src/ui/enhanced/enhancedFrame.js), MIT copyright2026 Lattymoy. Decoder, palette, dyes and sprite-addressing source under vendor/dfo-formats follows the matching official MIT source; its license is retained.

The exact loaded UI font stack is bundled in dashboard-fonts: Pixelify Sans (2021 Pixelify Sans Project Authors), the DFO Silkscreen five subset, and DFO’s custom two/Z grid glyphs. OFL notices for Pixelify Sans and Silkscreen are retained there. Replacement-glyph data is copied from the matching official src/ui/pixelifyFive.js (MIT).

Upgrade compatibility uses the matching installed DFO0.1.10435 equipRules-Bh4d3BnV.js static slot/hand tables, characters/equipTable.js and systems/equip.js restriction rules (MIT). Custom RRI slots use the matching rriItems.js class table; unknown custom/special base protection is not inferred. No equip methods are invoked.
