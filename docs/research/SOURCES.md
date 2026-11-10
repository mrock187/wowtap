# Source and hosting reconnaissance

Reviewed on November 10, 2026. World of Warcraft: Forever launched November 4. Coverage should include Eastern Kingdoms and Kalimdor, with Forever additions such as Riverglades and Zephras Isle where the source atlas supports them. [Blizzard launch announcement](https://worldofwarcraft.blizzard.com/en-us/news/24315820/world-of-warcraft-forever-now-live)

OpenMap's Forever tables and transform pipeline are the first metadata candidates. The license covers its code, tools and tables, with a separate asset notice. Its authored cleanup of world/continent lettering modifies Blizzard art. The Peligaming pipeline shows how UiMapAssignment, UiMapArt and overlays can be aligned, and its license explicitly separates client-derived map material from MIT tooling. The source ledger records both revisions. [OpenMap license](https://github.com/openmap-world/openmap/blob/d6cdee5569f5ac458b87ae5908730ee4c73e60d5/LICENSE) · [Peligaming license](https://github.com/peligwen/peligaming/blob/d5259f6dfec9016e6a2d26f94a8d58cf577438ca/LICENSE)

The workspace came with five instruction files and no licensed atlas or coordinate bundle. Public art remains a separate gate from testing with isolated technical fixtures.

Pages Free documents 20,000 files per site, 25 MiB per file and 500 builds per month. Static requests that invoke no Functions are free and unlimited. Recheck at the release gate. [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) · [Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/)
