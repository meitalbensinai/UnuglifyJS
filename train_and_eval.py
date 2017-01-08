#!/usr/bin/python

import multiprocessing
import os
import sys
import shutil
from subprocess import Popen,PIPE, STDOUT, call
import time

def PrintUsage():
  print """
Usage:
  train_and_eval.py --training_file <file> --test_dir <directory> --nice2predict_server <server> --path_length <length> --num_threads <number> --path_width <number>
"""
  exit(1)

def GetJSFilesInDir(d):
  for root, _, files in os.walk(d):
    for f in files:
      fname = os.path.join(root, f)
      if fname.endswith('.js'):
        yield fname


TMP_DIR = ""


if __name__ == '__main__':
  if (len(sys.argv) <= 8):
    PrintUsage()

  training_file = sys.argv[2]
  if (sys.argv[7] == "--path_length"):
    path_length = sys.argv[8]
  if (sys.argv[3] == "--test_dir"):
    test_dir = sys.argv[4]
  if (sys.argv[5] == "--nice2predict_server"):
    server = sys.argv[6]
  num_threads = 1
  if ((len(sys.argv) > 10) and sys.argv[9] == '--num_threads'):
    num_threads = int(sys.argv[10])
  path_width = 0;
  if ((len(sys.argv) > 12) and sys.argv[11] == '--path_width'):
    path_width = int(sys.argv[12])

    os.chdir("../Nice2Predict")
    command = "bin/training/train -num_threads %d  --input ./../UnuglifyJS/%s -training_method pl --out_model %s" % (num_threads, training_file, training_file)
    print command
    exit_code = call(command.split(' '))
    if (exit_code != 0):
      print "Training failed for max path length = %d, exiting" % path_length
      sys.exit(0)

    command = "./bin/server/nice2server"
    print command
    server_process = Popen(["./bin/server/nice2server", "--model %s" % training_file], stdout=PIPE, bufsize=1, stderr=STDOUT)
    #time.sleep(3)
    try:
      server_is_up = False
      while not server_is_up:
        nextline = server_process.stdout.readline()
        print nextline
        if nextline.find("Nice2Server started") >= 0:
          server_is_up = True
          print 'Nice2Server started'

      os.chdir("../UnuglifyJS")
      command = "python ./evaluate_dir.py --dir %s --server %s --logfile evaluation_%s --resultsfile results_%s --empty --num_threads %d --max_path_length %d --max_path_width %d" % (test_dir, server, training_file, training_file, multiprocessing.cpu_count(), path_length, path_width)
      print command
      os.system(command)
    finally:
      server_process.send_signal(2)
      print "Nice2Server stopped"


    print("Max path width=%d" % (path_width))
    with open("results_%dx%d" % (path_length, path_width), "r") as resultsFile:
      line = resultsFile.readline().strip()
    print("MAX PATH LENGTH=%d: %s" % (path_length, line))

  #print("ORIGINAL UnuglifyJS: %s" % line)

