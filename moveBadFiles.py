# movBadFiles.py <listFile> <newDir>
import sys
import os
import shutil

if __name__ == '__main__':
	listFileName = sys.argv[1]
	
	newLocation = sys.argv[2]
	with open(listFileName, "r") as filesList:
		for line in filesList:
			filename = line.rstrip('\n')
			try:
				targetPath = newLocation + filename[2:]
				targetDir = '/'.join(targetPath.split('/')[:-1])
				if (not os.path.exists(targetDir)):
					os.makedirs(targetDir)
				shutil.move(filename, targetPath)
				print 'Moved: ' + filename + ' to: ' + targetPath
			except Exception, ex:
				print 'Failed to move ' + filename + ': ' + str(ex)
				continue