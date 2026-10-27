"""Dünnplatten-Spline (Gummituch) ohne Zusatzbibliotheken – für die Entzerrung der Foto-Collage."""
import math
def _U(r2): return 0.0 if r2<=0 else r2*math.log(r2)
def _solve(M,v):
    n=len(M); M=[row[:] for row in M]; v=v[:]
    for c in range(n):
        p=max(range(c,n),key=lambda r:abs(M[r][c])); M[c],M[p]=M[p],M[c]; v[c],v[p]=v[p],v[c]
        piv=M[c][c]
        for r in range(c+1,n):
            f=M[r][c]/piv
            if f:
                Mr=M[r]; Mc=M[c]
                for k in range(c,n): Mr[k]-=f*Mc[k]
                v[r]-=f*v[c]
    x=[0]*n
    for r in range(n-1,-1,-1):
        x[r]=(v[r]-sum(M[r][k]*x[k] for k in range(r+1,n)))/M[r][r]
    return x
class TPS:
    """Dünnplatten-Spline von Quelle nach Ziel (2D), lam glättet."""
    def __init__(self,src,dst,lam=0.0,sq=1.0,dq=1.0):
        self.sq=sq; self.dq=dq
        self.s0=(sum(p[0] for p in src)/len(src), sum(p[1] for p in src)/len(src))
        self.d0=(sum(p[0] for p in dst)/len(dst), sum(p[1] for p in dst)/len(dst))
        S=[((p[0]-self.s0[0])/sq,(p[1]-self.s0[1])/sq) for p in src]
        D=[((p[0]-self.d0[0])/dq,(p[1]-self.d0[1])/dq) for p in dst]
        n=len(S); self.S=S
        M=[[0.0]*(n+3) for _ in range(n+3)]
        for i in range(n):
            for j in range(n):
                M[i][j]=_U((S[i][0]-S[j][0])**2+(S[i][1]-S[j][1])**2)+(lam if i==j else 0)
            M[i][n]=1; M[i][n+1]=S[i][0]; M[i][n+2]=S[i][1]
            M[n][i]=1; M[n+1][i]=S[i][0]; M[n+2][i]=S[i][1]
        self.wx=_solve(M,[d[0] for d in D]+[0,0,0]); self.wy=_solve(M,[d[1] for d in D]+[0,0,0])
    def __call__(self,p):
        x=(p[0]-self.s0[0])/self.sq; y=(p[1]-self.s0[1])/self.sq; n=len(self.S)
        fx=self.wx[n]+self.wx[n+1]*x+self.wx[n+2]*y; fy=self.wy[n]+self.wy[n+1]*x+self.wy[n+2]*y
        for i,(sx,sy) in enumerate(self.S):
            u=_U((x-sx)**2+(y-sy)**2); fx+=self.wx[i]*u; fy+=self.wy[i]*u
        return (fx*self.dq+self.d0[0], fy*self.dq+self.d0[1])
