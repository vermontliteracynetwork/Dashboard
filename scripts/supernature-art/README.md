# Supernature creature art

Pixel art for the Supernature Encyclopedia, drawn in code on a 48x48 grid (`kit.py` holds the shapes,
outlines and shading; `art1.py`, `art2.py` and `art3.py` hold one function per creature).

    cd scripts/supernature-art
    python3 -c "import importlib; from kit import A
    for m in ('art1','art2','art3'):
        for k, fn in importlib.import_module(m).__dict__[m.upper()].items():
            a = A(); fn(a); a.render().save(f'../../public/games/supernature/creatures/{k}.png')"

Zeus, Athena, Poseidon, Medusa, the Demon, the Jinn and the Dragon come from her packs instead.
