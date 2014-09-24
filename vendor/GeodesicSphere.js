/**
 * @author Inscrutabilis / mailto:iinscrutabilis@gmail.com
 */
 
/*
 * Generates a geodesic sphere geometry
 * By default, it is 1x1x1 octahedron, as a first approximation to sphere
 * It will return more sphere-like object if you specify iterations > 0
 * But please keep in mind that it generates (4 ^ iterations) * 8 faces
 * Radius argument overrides default sphere radius (1)
 */
var GeodesicSphere = function(iterations, radius) {
  iterations = iterations || 0;
  radius = radius || 1;
  THREE.Geometry.call(this);
  
  // initial 6 vertices of octahedron
  this.vertices.push((new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(radius)); // #0
  this.vertices.push((new THREE.Vector3(-1, 0, 1)).normalize().multiplyScalar(radius)); // #1
  this.vertices.push((new THREE.Vector3(1, 0, 1)).normalize().multiplyScalar(radius)); // #2
  this.vertices.push((new THREE.Vector3(1, 0, -1)).normalize().multiplyScalar(radius)); // #3
  this.vertices.push((new THREE.Vector3(-1, 0, -1)).normalize().multiplyScalar(radius)); // #4
  this.vertices.push((new THREE.Vector3(0, -1, 0)).normalize().multiplyScalar(radius)); // #5
  
  // and these duplicates we need to correctly map texture
  /*this.vertices.push(new THREE.Vertex((new THREE.Vector3(0, 0, 1)).normalize().multiplyScalar(radius))); // #6 (#0 duplicate)
  this.vertices.push(new THREE.Vertex((new THREE.Vector3(0, 0, 1)).normalize().multiplyScalar(radius))); // #7 (#0 duplicate)
  this.vertices.push(new THREE.Vertex((new THREE.Vector3(0, 0, 1)).normalize().multiplyScalar(radius))); // #8 (#0 duplicate)
  this.vertices.push(new THREE.Vertex((new THREE.Vector3(-1, 1, 0)).normalize().multiplyScalar(radius))); // #9 (#1 duplicate)
  this.vertices.push(new THREE.Vertex((new THREE.Vector3(0, 0, -1)).normalize().multiplyScalar(radius))); // #10 (#5 duplicate)
  this.vertices.push(new THREE.Vertex((new THREE.Vector3(0, 0, -1)).normalize().multiplyScalar(radius))); // #11 (#5 duplicate)
  this.vertices.push(new THREE.Vertex((new THREE.Vector3(0, 0, -1)).normalize().multiplyScalar(radius))); // #12 (#5 duplicate)*/
  
  // FIXME: if someone comes up with idea on how to reuse all of the generated vertices, implement it ASAP
  // FIXME: due to nature of faces, we need to pass texture UVs down to the last step. Absolutely logical, but looks non-elegant
  // FIXME: it is imperfect universe
  var faceGen = function faceGenerator(g, ia, ib, ic, ta, tb, tc, iterations) {
    if (iterations <= 0) {
      // this is the last iteration -- just save face and its UVs
      g.faces.push(new THREE.Face3(ia, ib, ic));
      g.uvs.push([ta, tb, tc]);
    } else {
      var va = g.vertices[ia];
      var vb = g.vertices[ib];
      var vc = g.vertices[ic];
      
      // calculate midpoints
      var pab = new THREE.Vector3((va.position.x + vb.position.x) / 2, (va.position.y + vb.position.y) / 2, (va.position.z + vb.position.z) / 2);
      var pbc = new THREE.Vector3((vb.position.x + vc.position.x) / 2, (vb.position.y + vc.position.y) / 2, (vb.position.z + vc.position.z) / 2);
      var pca = new THREE.Vector3((vc.position.x + va.position.x) / 2, (vc.position.y + va.position.y) / 2, (vc.position.z + va.position.z) / 2);
      // normalize them
      pab = pab.normalize().multiplyScalar(radius);
      pbc = pbc.normalize().multiplyScalar(radius);
      pca = pca.normalize().multiplyScalar(radius);
      
      // and their texture coordinates
      var tab = new THREE.UV((ta.u + tb.u) / 2, (ta.v + tb.v) / 2);
      var tbc = new THREE.UV((tb.u + tc.u) / 2, (tb.v + tc.v) / 2);
      var tca = new THREE.UV((tc.u + ta.u) / 2, (tc.v + ta.v) / 2);
      
      // save vertices array length for later use
      var vertArrayLength = g.vertices.length;
      
      // now create vertices and store them
      g.vertices.push(new THREE.Vertex(pab));
      g.vertices.push(new THREE.Vertex(pbc));
      g.vertices.push(new THREE.Vertex(pca));
      
      // and we know their indices
      var iab = vertArrayLength;
      var ibc = vertArrayLength + 1;
      var ica = vertArrayLength + 2;
      
      faceGenerator(g, ica, iab, ia, tca, tab, ta, iterations - 1);
      faceGenerator(g, ibc, ib, iab, tbc, tb, tab, iterations - 1);
      faceGenerator(g, ic, ibc, ica, tc, tbc, tca, iterations - 1);
      faceGenerator(g, ica, ibc, iab, tca, tbc, tab, iterations - 1);
    }
  }
  
  // finally! Do face generation for octahedron planes
  faceGen(this, 2, 1, 0, tuvs[2], tuvs[1], tuvs[0], iterations);
  faceGen(this, 3, 2, 0, tuvs[3], tuvs[2], tuvs[6], iterations);
  faceGen(this, 4, 3, 0, tuvs[4], tuvs[3], tuvs[7], iterations);
  faceGen(this, 1, 4, 0, tuvs[9], tuvs[4], tuvs[8], iterations);
  faceGen(this, 1, 2, 5, tuvs[1], tuvs[2], tuvs[5], iterations);
  faceGen(this, 2, 3, 5, tuvs[2], tuvs[3], tuvs[10], iterations);
  faceGen(this, 3, 4, 5, tuvs[3], tuvs[4], tuvs[11], iterations);
  faceGen(this, 4, 1, 5, tuvs[4], tuvs[9], tuvs[12], iterations);
  
  this.computeCentroids();
	this.computeFaceNormals();
	this.sortFacesByMaterial();
}
 
GeodesicSphere.prototype = new THREE.Geometry();
GeodesicSphere.prototype.constructor = GeodesicSphere;