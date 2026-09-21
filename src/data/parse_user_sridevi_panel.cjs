const fs = require('fs');
const path = require('path');

const rawText = `
04/01/2021
to
10/01/2021	4
5
9	80	2
8
0	4
6
6	64	7
7
0	2
2
9	35	8
8
9	1
2
6	92	4
8
0	2
4
7	35	1
1
3	2
7
8	72	3
4
5	5
6
7	84	1
3
0
11/01/2021
to
17/01/2021	2
3
4	98	2
3
3	2
4
9	53	3
4
6	6
7
0	32	2
2
8	4
8
9	18	4
6
8	4
5
7	63	6
8
9	5
7
9	10	1
2
7	2
7
9	86	1
7
8
18/01/2021
to
24/01/2021	1
5
8	43	6
7
0	4
8
9	17	8
9
0	2
8
0	04	5
9
0	2
3
7	20	4
7
9	2
4
5	12	6
8
8	1
3
0	41	3
9
9	1
6
8	59	3
7
9
25/01/2021
to
31/01/2021	1
3
5	95	4
4
7	*
*
*	**	*
*
*	4
6
7	77	4
4
9	6
7
9	24	7
8
9	2
4
9	55	3
4
8	3
4
7	46	5
5
6	4
7
8	90	5
7
8
01/02/2021
to
07/02/2021	4
4
8	63	1
2
0	3
5
6	48	1
3
4	5
5
9	97	3
7
7	5
7
7	92	1
3
8	5
5
7	77	1
1
5	5
8
9	21	4
7
0	1
6
8	52	6
6
0
08/02/2021
to
14/02/2021	8
9
9	67	4
5
8	3
9
9	10	1
9
0	1
2
5	87	2
7
8	2
5
9	66	3
6
7	4
4
5	31	3
4
4	4
7
9	00	1
1
8	3
5
9	70	6
7
7
15/02/2021
to
21/02/2021	6
7
8	11	3
8
0	3
7
7	74	1
6
7	3
3
4	06	2
4
0	1
2
9	24	2
4
8	3
6
0	99	1
2
6	2
6
8	60	1
4
5	3
5
7	55	1
5
9
22/02/2021
to
28/02/2021	5
6
9	04	3
4
7	3
7
8	82	5
8
9	1
4
8	39	3
7
9	1
5
6	24	3
5
6	2
6
7	52	1
4
7	4
5
9	88	1
8
9	2
3
4	98	5
6
7
01/03/2021
to
07/03/2021	4
5
7	66	1
7
8	2
6
9	74	2
5
7	1
1
2	47	4
6
7	1
5
7	38	1
7
0	4
6
9	91	4
8
9	3
7
0	06	2
6
8	3
6
9	80	1
1
8
08/03/2021
to
14/03/2021	3
6
0	98	2
3
3	1
5
8	40	2
2
6	1
7
8	66	7
9
0	5
8
8	16	3
4
9	1
5
7	39	6
6
7	1
8
8	72	2
5
5	7
7
0	46	1
1
4
`;

// Parse DPBoss raw text blocks
function parseDpbossTextBlock(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const rows = [];
  let curRow = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('to') || line.includes('Date') || /^\d{2}\/\d{2}\/\d{4}$/.test(line)) {
      if (curRow.length > 0) {
        rows.push(curRow);
        curRow = [];
      }
      continue;
    }
    
    // Check tab separated line or space separated digits
    const parts = line.split('\t').filter(Boolean);
    parts.forEach(p => curRow.push(p));
  }
  if (curRow.length > 0) rows.push(curRow);
  return rows;
}

console.log('Done parsing raw text setup.');
