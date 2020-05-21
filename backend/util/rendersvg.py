import subprocess
import os


def convert_to_svg(pdf_path, svg_path):
    DEVNULL = open(os.devnull, 'w')
    return_code = subprocess.call([
        'pdftocairo',
        '-svg',
        u'{pdf_path}'.format(pdf_path=pdf_path),
        u'{svg_path}'.format(svg_path=svg_path),
    ], stdout=DEVNULL, stderr=subprocess.STDOUT, close_fds=True)
    if return_code:
        return False
    return True
