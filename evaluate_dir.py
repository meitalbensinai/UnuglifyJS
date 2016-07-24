#!/usr/bin/python

import multiprocessing
import os
import sys
import shutil

def PrintUsage():
  print """
Usage:
  evaluate_dir.py --dir <directory>
"""
  exit(1)

def GetJSFilesInDir(d):
  for root, _, files in os.walk(d):
    for f in files:
      fname = os.path.join(root, f)
      if fname.endswith('.js'):
        yield fname


TMP_DIR = ""

def EvaluateFile(f):
  global TMP_DIR
  os.system("nodejs bin/unuglifyjs --evaluate --max_path_length=10 --skip_minified '%s' >> %s/%d" % (f, TMP_DIR, os.getpid()))

def EvaluateFileList(files):
  global TMP_DIR
  TMP_DIR = "./tmp/evaluate_dir%d" % (os.getpid())
  if os.path.exists(TMP_DIR):
    shutil.rmtree(TMP_DIR)
  os.makedirs(TMP_DIR)
  try:
    p = multiprocessing.Pool(multiprocessing.cpu_count())
    p.map(EvaluateFile, files)
    output_files = os.listdir(TMP_DIR)
    for f in output_files:
      os.system("cat %s/%s" % (TMP_DIR, f))
  finally:
    shutil.rmtree(TMP_DIR)


if __name__ == '__main__':
  if (len(sys.argv) <= 1):
    PrintUsage()

  # Process command line arguments
  if (sys.argv[1] == "--dir"):
    files = [f for f in GetJSFilesInDir(sys.argv[2])]
  else:
    PrintUsage()
  # Remove files that say they are minified.
  files = [f for f in files if not f.endswith('.min.js')]
  EvaluateFileList(files)

