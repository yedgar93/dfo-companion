# Automatic equipment recommendations

Recommendations work from the existing cached detail snapshot for any named or
custom career. No class-name lookup, network service, AI call, extra game read,
game method, or changed sampling interval is involved.

## Meaning of the arrow

A green arrow means **recommended for the inferred build**, not a guaranteed
increase in live DPS or an instruction to equip it automatically. A weighted
gain may outweigh a smaller loss; all recorded gains and losses remain visible.
Unknown compatibility or unsupported effects prevent a green recommendation.
Wear alone earns no upgrade; broken items are blocked and lower-condition
replacements retain the repair advice. Prices and rarity do not determine rank.

Automatic comparison checks every supported slot and selects the best known
result. Each worn slot can independently show its compatible alternatives.
These are individual swap suggestions, not a promise that every highlighted
item can be equipped simultaneously (paired slots can suggest the same item).
The explicit target selector only changes that inspection's comparison.

## Inferring a build

`buildProfile()` uses career primary/major/minor skills, with priorities 3/2/1,
plus permanent skill proficiency divided by 50 (displayed proficiency is the
fallback). Combat, magic and stealth contributions are normalized into a blend;
a hybrid retains all three rather than being forced into a named class. Combat
includes weapon skills, Dodging and Critical Strike. Magic includes the six
spell schools. Stealth includes Stealth, Lockpicking, Pickpocket and Backstabbing.
Equipment skill boosts do not change the blend when permanent skills are known.
The armor description uses the majority worn material family, normalizing RRI's
custom material encodings. Career weapon/armor/shield/material bans remain hard
eligibility checks, independent of score.

The attribute preferences for combat/magic/stealth respectively are:

| Attribute | Combat | Magic | Stealth |
| --- | ---: | ---: | ---: |
| Strength | 1 | .2 | .4 |
| Intelligence | .1 | 1 | .3 |
| Willpower | .2 | 1 | .3 |
| Agility | 1 | .4 | 1 |
| Endurance | 1 | .5 | .5 |
| Personality | .1 | .2 | .4 |
| Speed | .7 | .4 | 1 |
| Luck | .5 | .5 | .8 |

These are explainable product defaults, **not game formulas or measured player
preferences**. Attribute weights blend by the profile. Preferred weapon skills
weigh 1, other favoured career skills .6 and other known skills .2. Carry capacity
weighs .3, resistance .4; spell cost/damage/casting bonuses scale with the magic
share. Other affix weights are centralized in `affixWeight()`. Every known loss
is still printed, including low-weight standing, warmth and weatherproofing.

## Evaluating a swap

`createBuildEvaluator()` compares the complete removed/incoming items. It applies
the difference in their attribute and skill bonuses to the **live baseline**,
then re-scores retained weapons as well as an incoming weapon. This avoids
counting worn gear twice. Effective skill values already present in the copied
snapshot are reused for combat, including the existing mastery/mentor scaling.
Attributes use the normal 100 ceiling while preserving an already higher live
ceiling; unknown dynamic maximum modifiers are not simulated.

Reference weapon output includes the existing material/skill/Strength/expertise/
race calculation. When weight and Speed are available, the SWING-LAW reference
tempo includes heft and handling. Bare hands use the reference Hand-to-Hand
damage range. Two weapons use a balanced-hand average, not an assertion about
lead-hand choice or the player's flurry cadence. Output change weighs
`1 + combat share`; changed armor protection adds its body-frequency-weighted
rating. Remaining affix changes and supported set enchantments add their
weighted values. A score gain above .05 is recommended. The number is a relative
build score, not percent DPS. Utilities use the same ranking path as combat gear.
Equal scores resolve by name and inventory index, independent of input order.

RRI armor uses its own chain/light ladders; leather/fur requires the copied
appearance message. Resistance respects the 45-point rolled-gear cap beside
non-rolled gear. Strengthens Armor and Increased Weight Allowance retain their
non-stacking/highest-only behavior. Unknown enchantments, special effects,
missing required stats remain explicit. When either weapon clock is unavailable,
both sides use output per attack, with a timing caveat; per-second and per-attack
units are never mixed. Changing to, from, or between ranged weapon types is an
amber loadout choice rather than a green recommendation or blanket question mark.
Matching bows can be compared in the currently observed worn hand: the same
bow type's reference draw behavior cancels. Bow hand settings remain a caveat
when changing loadouts.
Sixteen copied affixes are preserved; reaching an existing copy limit marks
coverage uncertain rather than requesting more game data.

### Missing optional template enrichment (0.4.32)

The optional live template cache can be empty after a game bundle change, and
its copied JSON does not own the computed `weaponSkillUsed` property. Previously
this left even identified weapons without comparison stats. `projectDetails()`
now calls `completeEquipmentData()` to fill missing weapon skill, damage, weight
and hand data using the reviewed DFO template IDs; armor uses the verified
material/RRI/shield tables. Copied item damage overrides and weight take priority,
and existing display data is preserved. Material damage is added exactly once.
Unknown template IDs remain unknown; display names are never used to infer stats.
These are offline fallbacks, so later game balance changes may require updating
them. They do not read getters, import game modules, or add observer work.

Genuinely unidentified effects still prevent a green recommendation. Missing
unidentified effect arrays are distinct from actual snapshot overflow; their
marker explains identification rather than falsely reporting a coverage limit.

## Performance and verification

One comparison session shares its build model and memoizes each candidate and
target for a pack snapshot. `prepareComparisons()` yields between batches after
about 4 ms in the **Companion browser**, and cancels work superseded by a newer
snapshot. While preparing, the UI displays comparison-pending markers instead
of arrows from the previous snapshot. Hover, filter and sort reuse the results.
The 500-item ceiling and bounded numeric weapon ranges prevent unbounded work.
This adds no work inside DFO's renderer and does not change any reader/transport
or idle-sampling code. Synthetic timing is not proof of real-device game FPS.

Tests: `src/test/build-recommendations.test.mjs`, the existing upgrade tests,
and `node scripts/check-upgrades-ui.mjs` (Playwright Chromium; optional
`DFO_TEST_BROWSER` selects an already-installed browser). The UI check serves
invented data through the actual allowlisted server and refuses game launch and
manual refresh. It does not use the installed Companion or DFO.

## DFO source review and limits

Reviewed public DFO source at commit
[`b0765ab216c019c2a4a3c466cecd0464c5c923b9`](https://github.com/Lattymoy/daggerfall-js-source/tree/b0765ab216c019c2a4a3c466cecd0464c5c923b9):

- `src/characters/equipRules.js`, `equipTable.js`, `weaponStates.js`
- `src/combat/formulas.js`, `twoHands/handsLaw.js`
- `src/systems/armorMaterials.js`, `roleplayRealismItems/rriItems.js`
- `src/systems/loot/lootRarity.js`, `skills.js`, `enchantments.js`
- `bible/05-Combat/Physical-Combat-Overhaul.md`, `Two-Hands.md`

The public source is not proof of the user's running build. Combat overhaul
settings can change Strength, armor, condition, critical strike and material
behavior; weapon clocks, ranged draws, enemy resistances, temporary effects,
set hooks and player tactics can also change outcomes. The snapshot does not
expose all those switches. Consequently the UI labels scores as estimates and
does not claim exact DPS, universally optimal loadouts or full enchantment
simulation. There is no runtime dependence on this source repository.
