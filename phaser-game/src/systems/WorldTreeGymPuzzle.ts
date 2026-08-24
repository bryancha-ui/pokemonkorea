export type WorldTreeNodeId =
  | 'root'
  | 'lower-left'
  | 'lower-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'upper-left'
  | 'upper-right'
  | 'crown-left'
  | 'crown-right'
  | 'summit';

export interface WorldTreeNode {
  id: WorldTreeNodeId;
  index: number;
  col: number;
  row: number;
  elevation: number;
  connections: readonly WorldTreeNodeId[];
  trainerKey?: 'forest-chungha' | 'forest-minho';
  required: boolean;
}

/**
 * An undirected canopy graph. Every branch can be revisited, so choosing one
 * fork never strands the player; the summit remains sealed until all nine
 * proper branches have been landed on at least once.
 */
export const WORLD_TREE_NODES: readonly WorldTreeNode[] = [
  {
    id: 'root', index: 0, col: 8.5, row: 17.65, elevation: 0.8, required: false,
    connections: ['lower-left', 'lower-right'],
  },
  {
    id: 'lower-left', index: 1, col: 4.5, row: 15.4, elevation: 1.8, required: true,
    trainerKey: 'forest-chungha',
    connections: ['root', 'lower-right', 'middle-left', 'middle-center'],
  },
  {
    id: 'lower-right', index: 2, col: 12.4, row: 15.0, elevation: 1.95, required: true,
    connections: ['root', 'lower-left', 'middle-center', 'middle-right'],
  },
  {
    id: 'middle-left', index: 3, col: 3.4, row: 12.0, elevation: 3.1, required: true,
    connections: ['lower-left', 'middle-center', 'upper-left'],
  },
  {
    id: 'middle-center', index: 4, col: 8.3, row: 12.65, elevation: 3.0, required: true,
    connections: ['lower-left', 'lower-right', 'middle-left', 'middle-right', 'upper-left', 'upper-right'],
  },
  {
    id: 'middle-right', index: 5, col: 13.1, row: 11.7, elevation: 3.25, required: true,
    connections: ['lower-right', 'middle-center', 'upper-right'],
  },
  {
    id: 'upper-left', index: 6, col: 4.8, row: 8.55, elevation: 4.45, required: true,
    connections: ['middle-left', 'middle-center', 'upper-right', 'crown-left'],
  },
  {
    id: 'upper-right', index: 7, col: 11.8, row: 8.1, elevation: 4.7, required: true,
    trainerKey: 'forest-minho',
    connections: ['middle-right', 'middle-center', 'upper-left', 'crown-right'],
  },
  {
    id: 'crown-left', index: 8, col: 6.2, row: 5.2, elevation: 5.9, required: true,
    connections: ['upper-left', 'crown-right', 'summit'],
  },
  {
    id: 'crown-right', index: 9, col: 10.4, row: 5.0, elevation: 6.1, required: true,
    connections: ['upper-right', 'crown-left', 'summit'],
  },
  {
    id: 'summit', index: 10, col: 8.3, row: 2.15, elevation: 7.25, required: false,
    connections: ['crown-left', 'crown-right'],
  },
] as const;

export const WORLD_TREE_REQUIRED_BRANCHES = WORLD_TREE_NODES.filter(node => node.required);

export function worldTreeNode(id: unknown): WorldTreeNode | undefined {
  return WORLD_TREE_NODES.find(node => node.id === id);
}

export function worldTreeVisitedFlag(node: WorldTreeNode): string {
  return `forestTreeVisited_${node.id}`;
}

export function worldTreeVisited(node: WorldTreeNode, read: (key: string) => unknown): boolean {
  return !node.required || !!read('forestGymDefeated') || !!read(worldTreeVisitedFlag(node));
}

export function worldTreeVisitedCount(read: (key: string) => unknown): number {
  return WORLD_TREE_REQUIRED_BRANCHES.filter(node => worldTreeVisited(node, read)).length;
}

export function worldTreeComplete(read: (key: string) => unknown): boolean {
  return worldTreeVisitedCount(read) === WORLD_TREE_REQUIRED_BRANCHES.length;
}

/** Badge saves predate this traversal. Their completed Gym remains authoritative. */
export function reconcileWorldTreeProgress(
  read: (key: string) => unknown,
  write: (key: string, value: unknown) => void,
): number {
  if (read('forestGymDefeated')) {
    for (const node of WORLD_TREE_REQUIRED_BRANCHES) write(worldTreeVisitedFlag(node), true);
  } else {
    for (const node of WORLD_TREE_REQUIRED_BRANCHES) {
      if (node.trainerKey && read(`trainerDefeated_${node.trainerKey}`)) {
        write(worldTreeVisitedFlag(node), true);
      }
    }
  }
  return worldTreeVisitedCount(read);
}
