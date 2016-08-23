#!/usr/bin/python

import multiprocessing
import os
import sys
import shutil
import subprocess
from collections import Counter, OrderedDict


def GetJSFilesInDir(d):
  for root, _, files in os.walk(d):
    for f in files:
      fname = os.path.join(root, f)
      if fname.endswith('.js'):
        yield fname


if __name__ == '__main__':
  # Process command line arguments
  files = [f for f in GetJSFilesInDir(sys.argv[1])]
  n = int(sys.argv[2])
  # Remove files that say they are minified.
  files = [f for f in files if not f.endswith('.min.js')]
  distinctCount = 0
  totalFiles = 0
  histogram = {}
  for file in files:
    totalFiles += 1
    filename = os.path.basename(file)
    #print filename
    if (histogram.has_key(filename)):
      histogram[filename] += 1
    else:
      histogram[filename] = 1
      distinctCount += 1

  top = dict(Counter(histogram).most_common(n))
  sortedTopValues = OrderedDict(sorted(top.items(), key=lambda t: t[1], reverse=True))

  print 'Total files: ' + str(totalFiles)
  print 'Distinct files: ' + str(distinctCount)
  print 'Duplications: ' + str(totalFiles - distinctCount)
  print 'Top ' + str(n) + ' recurring file names: '
  print sortedTopValues
