/* MoveNet Lightning（17点）を端末内で動かす。モデルは呼び出し側が渡す。 */
(function (root) {
  var SIZE = 192, model = null, cv = null, cx = null;

  async function init(json, weightData) {
    await tf.ready();
    var handler = tf.io.fromMemory({
      modelTopology: json.modelTopology,
      weightSpecs: json.weightsManifest[0].weights,
      weightData: weightData,
      format: json.format, generatedBy: json.generatedBy, convertedBy: json.convertedBy,
      signature: json.signature
    });
    model = await tf.loadGraphModel(handler);
    cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
    cx = cv.getContext('2d', { willReadFrequently: true });
    // ウォームアップ
    tf.tidy(function () { model.predict(tf.zeros([1, SIZE, SIZE, 3], 'int32')); });
    return tf.getBackend();
  }

  /* 画像(w×h)の中の正方形 [sx,sy,s] を 192x192 に切り出して推論。範囲外は黒。 */
  async function runCrop(img, w, h, sx, sy, s) {
    cx.fillStyle = '#000'; cx.fillRect(0, 0, SIZE, SIZE);
    var k = SIZE / s;
    var x0 = Math.max(0, sx), y0 = Math.max(0, sy), x1 = Math.min(w, sx + s), y1 = Math.min(h, sy + s);
    if (x1 > x0 && y1 > y0) cx.drawImage(img, x0, y0, x1 - x0, y1 - y0, (x0 - sx) * k, (y0 - sy) * k, (x1 - x0) * k, (y1 - y0) * k);
    var out = tf.tidy(function () {
      var inp = tf.browser.fromPixels(cv).expandDims(0).toInt();
      return model.predict(inp);
    });
    var d = await out.data(); out.dispose();
    var kp = [];
    for (var i = 0; i < 17; i++) {
      kp.push({ x: (sx + d[i * 3 + 1] * s) / w, y: (sy + d[i * 3] * s) / h, s: d[i * 3 + 2] });
    }
    return kp;
  }

  function box(kp, w, h) {
    var xs = [], ys = [];
    kp.forEach(function (p) { if (p.s > 0.2) { xs.push(p.x * w); ys.push(p.y * h); } });
    if (xs.length < 4) return null;
    return [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)];
  }

  /* 全身が写った1枚から17点を求める。1回目は全体、2回目以降は人物周辺を拡大して精度を上げる。 */
  async function detect(img) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var s0 = Math.max(w, h);
    var kp = await runCrop(img, w, h, (w - s0) / 2, (h - s0) / 2, s0);
    for (var pass = 0; pass < 2; pass++) {
      var b = box(kp, w, h);
      if (!b) break;
      var cxm = (b[0] + b[2]) / 2, cym = (b[1] + b[3]) / 2;
      var s = Math.max(b[2] - b[0], b[3] - b[1]) * 1.35;
      s = Math.max(s, Math.min(w, h) * 0.25);
      kp = await runCrop(img, w, h, cxm - s / 2, cym - s / 2, s);
    }
    return kp;
  }

  root.PoseCore = { init: init, detect: detect };
})(window);
