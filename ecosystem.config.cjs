module.exports = {
  apps: [
    {
      name: 'pinchy-mcp',
      cwd: '/opt/pinchy-mcp',
      script: 'dist/main.js',
      node_args: '--env-file-if-exists=.env',
      // Takes input from strangers; it must not share a user with anything that holds secrets.
      uid: 'pinchy-mcp',
      gid: 'pinchy-mcp',
      max_memory_restart: '200M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
