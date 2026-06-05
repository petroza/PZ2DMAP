# PZ 2D Map

Browser-based 2D map editor for drawing routes, markers, labels, camera moves and exporting map frames/video-ready assets.

## Important change

The red `TN` logo block in the upper-left sidebar was removed from the page. The app header now shows only `PZ MAP`.

## Main files

```text
index.html      Main application
PZ2DMAP         Compatibility copy of the same app
map_api.php     Optional PHP API for saving/loading projects on PHP hosting
presets.json    Style presets
projects.json   Example/project data
map_data/       Runtime data directory placeholders
assets/         Original local icons
```

## Deployment

Upload the files to any static/PHP hosting. For saving projects on the server, PHP must be enabled and `map_api.php` must be writable to the configured data files.

## Notes

The main `index.html` embeds the original plane/car icons as data URIs, so the page can still run even when asset upload is incomplete.

## License

Application wrapper code is published under the MIT License unless a file states otherwise. Third-party map providers and map data keep their own terms and licenses.
