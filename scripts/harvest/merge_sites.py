import pandas as pd

osm = pd.read_csv("/home/wwitschey/MayaAtlas/data/raw/open-datasets/osm_sites.csv")
wiki = pd.read_csv("/home/wwitschey/MayaAtlas/data/raw/open-datasets/wikidata_sites.csv")

df = pd.concat([osm, wiki])

df = df.drop_duplicates(subset=["longitude", "latitude"])

df.to_csv(
    "/home/wwitschey/MayaAtlas/data/curated/open-datasets/sites_normalized.csv",
    index=False
)

print(f"Final dataset: {len(df)} sites")