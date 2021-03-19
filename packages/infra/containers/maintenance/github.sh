#!/bin/sh
function authenticated() {
  # Attempt to ssh to GitHub
  ssh -T git@github.com &>/dev/null
  RET=$?
  if [ $RET == 1 ]; then
    # user is authenticated, but fails to open a shell with GitHub 
    return 0
  elif [ $RET == 255 ]; then
    # user is not authenticated
    return 1
  else
    echo "unknown exit code in attempt to ssh into git@github.com"
  fi
  return 2
}

if authenticated; then
  echo "GitHub deploy keys ready"
else
  echo "Cannot connect to github. Make sure the following is added to the project's deploy keys:"
  cat /root/.ssh/id_rsa.pub
fi
