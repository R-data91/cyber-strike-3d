/**
 * Three.js Recursive Hierarchy Cleanup Utility
 * Completely releases GPU buffers, geometries, materials, and textures
 * to prevent memory leaks across waves and entity lifecycles.
 */
export function disposeHierarchy(obj) {
  if (!obj) return;

  obj.traverse(child => {
    if (child.isMesh || child.isPoints || child.isLine) {
      if (child.geometry && !child.userData.preserveGeometry) {
        try { child.geometry.dispose(); } catch (e) {}
      }
      if (child.material && !child.userData.preserveMaterial) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => {
            if (m.map) { try { m.map.dispose(); } catch (e) {} }
            try { m.dispose(); } catch (e) {}
          });
        } else {
          if (child.material.map) { try { child.material.map.dispose(); } catch (e) {} }
          try { child.material.dispose(); } catch (e) {}
        }
      }
    }
    if (child.isLight && typeof child.dispose === 'function') {
      try { child.dispose(); } catch (e) {}
    }
  });
}
