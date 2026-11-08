// www.miroslaw-shpak.dev -> miroslaw-shpak.dev, path and query preserved
export default {
  fetch(req) {
    const u = new URL(req.url)
    u.hostname = 'miroslaw-shpak.dev'
    u.protocol = 'https:'
    return Response.redirect(u.toString(), 301)
  },
}
