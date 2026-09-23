/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    if (window.location.pathname === '/' || window.location.pathname === '') {
      window.location.replace('/index.html');
    }
  }, []);

  return null;
}

